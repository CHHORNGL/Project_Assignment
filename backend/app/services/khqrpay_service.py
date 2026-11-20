"""KHQRPay REST API & Webhook Integration (https://khqrpay.dev).

Implements:
- Payment creation (`POST /v1/payments`) with per-attempt `Idempotency-Key`,
  strict error-code branching, rate-limit (`429`) and read-budget handling,
  and idempotent `500`/`502`/`503` retries.
- Payment retrieval (`GET /v1/payments/:id`), list (`GET /v1/payments`),
  usage (`GET /v1/usage`), test simulation (`POST /v1/test/payments/:id/simulate`),
  and pre-cancellation verification respecting the 1-hour post-expiry late-payment
  window and `monitoring_gap` flag.
- Webhook signature verification (`webhooks.construct_event`) on raw request bytes
  using constant-time `hmac.compare_digest` (delegating to the official `khqrpay`
  Python SDK when installed), 5-minute timestamp tolerance, event-ID deduplication,
  test/livemode isolation, `requested_amount`/`requested_currency` verification,
  and late `payment.completed` fulfilment after `payment.expired`.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote, urlencode
from uuid import uuid4

from flask import current_app, has_app_context
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.khqrpay_webhook_event import KHQRPayWebhookEvent
from app.models.payment_transaction import PaymentTransaction
from app.models.premium_coupon import PremiumCoupon
from app.models.user import User

try:
    import khqrpay as _khqrpay_sdk  # type: ignore[import-not-found]
except ImportError:
    _khqrpay_sdk = None

logger = logging.getLogger(__name__)

KHQRPAY_DEFAULT_BASE_URL = "https://khqrpay.dev"
WEBHOOK_TOLERANCE_SECONDS = 300  # 5 minutes (Requirement 3)
LATE_EXPIRY_GRACE_SECONDS = 3600  # 1 hour after expires_at before treating expired as final (Requirement 8)
MAX_IDEMPOTENCY_KEY_LENGTH = 255
MAX_REFERENCE_ID_LENGTH = 255
MAX_METADATA_KEYS = 50
MAX_METADATA_BYTES = 4096
MAX_METADATA_DEPTH = 8
MAX_INLINE_RETRY_AFTER_SECONDS = 60


class KHQRPayError(Exception):
    """Base exception for KHQRPay operations."""


class KHQRPayWebhookVerificationError(KHQRPayError):
    """Raised when a webhook signature header, secret, timestamp, or payload is invalid."""


class KHQRPayAPIError(KHQRPayError):
    """Raised when the KHQRPay REST API returns an error response.

    Callers should branch on `error_code` (the stable `error` field), never on `message`.
    """

    def __init__(
        self,
        error_code: str,
        message: str,
        *,
        status_code: int = 400,
        retry_after: int | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(f"{error_code}: {message}")
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after
        self.headers = headers or {}


def _get_base_url() -> str:
    raw = ""
    if has_app_context():
        raw = str(current_app.config.get("KHQRPAY_BASE_URL") or "").strip()
    if not raw:
        raw = os.getenv("KHQRPAY_BASE_URL", KHQRPAY_DEFAULT_BASE_URL).strip()
    base = (raw or KHQRPAY_DEFAULT_BASE_URL).rstrip("/")
    if not base.lower().startswith("https://"):
        raise KHQRPayAPIError(
            "https_required",
            "KHQRPay API calls must use https://khqrpay.dev.",
            status_code=403,
        )
    return base


def _get_secret_key(explicit_key: str | None = None) -> str:
    if explicit_key is not None:
        key = explicit_key.strip()
    else:
        key = ""
        if has_app_context():
            key = str(current_app.config.get("KHQRPAY_SECRET_KEY") or "").strip()
        if not key:
            key = os.getenv("KHQRPAY_SECRET_KEY", "").strip()
    if not key:
        raise KHQRPayAPIError(
            "unauthorized",
            "KHQRPAY_SECRET_KEY is not configured on the server.",
            status_code=401,
        )
    return key


def _get_webhook_secret(explicit_secret: str | None = None) -> str:
    if explicit_secret is not None:
        return explicit_secret.strip()
    secret = ""
    if has_app_context():
        secret = str(current_app.config.get("KHQRPAY_WEBHOOK_SECRET") or "").strip()
    if not secret:
        secret = os.getenv("KHQRPAY_WEBHOOK_SECRET", "").strip()
    return secret


def format_khqrpay_amount(amount: float | str | Decimal, currency: str = "USD") -> str:
    """Validate and normalize a payment amount for USD (2 decimals) or KHR (whole riel)."""
    norm_currency = (currency or "USD").strip().upper()
    if norm_currency not in {"USD", "KHR"}:
        raise KHQRPayAPIError("invalid_request", "currency must be USD or KHR.", status_code=400)

    if isinstance(amount, bool):
        raise KHQRPayAPIError("invalid_amount", "amount must be a number or numeric string.", status_code=400)

    try:
        dec = Decimal(str(amount).strip())
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise KHQRPayAPIError("invalid_amount", "amount is not a valid number.", status_code=400) from exc

    if not dec.is_finite():
        raise KHQRPayAPIError("invalid_amount", "amount must be finite.", status_code=400)

    if norm_currency == "USD":
        exponent = dec.as_tuple().exponent
        if isinstance(exponent, int) and exponent < -2:
            raise KHQRPayAPIError("invalid_amount", "USD amount cannot have more than 2 decimal places.", status_code=400)
        quantized = dec.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if quantized < Decimal("0.01"):
            raise KHQRPayAPIError("amount_too_low", "Minimum USD amount is 0.01.", status_code=400)
        return f"{quantized:.2f}"

    # KHR requires whole riel with no decimals
    if dec != dec.to_integral_value():
        raise KHQRPayAPIError("invalid_amount", "KHR amount must be whole riel.", status_code=400)
    riel = int(dec)
    if riel < 1:
        raise KHQRPayAPIError("amount_too_low", "Minimum KHR amount is 1 riel.", status_code=400)
    return str(riel)


def _normalize_metadata(value: Any, *, depth: int = 1) -> Any:
    """Validate metadata depth and convert integers longer than 15 digits to strings."""
    if depth > MAX_METADATA_DEPTH:
        raise KHQRPayAPIError(
            "invalid_request",
            f"metadata cannot exceed {MAX_METADATA_DEPTH} levels of nesting.",
            status_code=400,
        )
    if isinstance(value, bool) or value is None or isinstance(value, (str, float)):
        return value
    if isinstance(value, int):
        if len(str(abs(value))) > 15:
            return str(value)
        return value
    if isinstance(value, dict):
        if depth == 1 and len(value) > MAX_METADATA_KEYS:
            raise KHQRPayAPIError(
                "invalid_request",
                f"metadata cannot have more than {MAX_METADATA_KEYS} keys.",
                status_code=400,
            )
        return {str(k): _normalize_metadata(v, depth=depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize_metadata(item, depth=depth + 1) for item in value]
    return str(value)


def validate_metadata(metadata: dict[str, Any] | None) -> dict[str, Any] | None:
    if metadata is None:
        return None
    if not isinstance(metadata, dict):
        raise KHQRPayAPIError("invalid_request", "metadata must be a JSON object.", status_code=400)
    normalized = _normalize_metadata(metadata, depth=1)
    encoded = json.dumps(normalized, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if len(encoded) > MAX_METADATA_BYTES:
        raise KHQRPayAPIError("invalid_request", "metadata cannot exceed 4 KB.", status_code=400)
    return normalized


def build_attempt_idempotency_key(
    reference_id: str | int,
    attempt: int | str | None = None,
    *,
    idempotency_key: str | None = None,
) -> str:
    """Build a per-attempt Idempotency-Key (Requirement 9)."""
    if idempotency_key is not None:
        cleaned = idempotency_key.strip()
        if not cleaned:
            raise KHQRPayAPIError("invalid_request", "Idempotency-Key cannot be blank.", status_code=400)
        if len(cleaned) > MAX_IDEMPOTENCY_KEY_LENGTH:
            raise KHQRPayAPIError(
                "invalid_request",
                f"Idempotency-Key cannot exceed {MAX_IDEMPOTENCY_KEY_LENGTH} characters.",
                status_code=400,
            )
        return cleaned

    ref_str = str(reference_id).strip()
    if not ref_str:
        raise KHQRPayAPIError("invalid_request", "reference_id is required.", status_code=400)
    attempt_suffix = str(attempt if attempt is not None else uuid4().hex[:12]).strip()
    key = f"{ref_str}-attempt-{attempt_suffix}"
    if len(key) > MAX_IDEMPOTENCY_KEY_LENGTH:
        key = key[:MAX_IDEMPOTENCY_KEY_LENGTH]
    return key


def build_khqr_svg_url(qr_string: str | None, *, base_url: str | None = None) -> str | None:
    """Build the public 300x430 KHQR card SVG URL for a payment's qr_string."""
    if not qr_string:
        return None
    base = (base_url or _get_base_url()).rstrip("/")
    encoded_qr = quote(qr_string, safe="")
    return f"{base}/api/render/khqr/{encoded_qr}.svg"


def parse_iso_datetime(value: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp string into a UTC naive datetime."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class _WebhooksNamespace:
    """Webhook verification helper compatible with `khqrpay.webhooks.construct_event`."""

    @staticmethod
    def construct_event(
        raw_body: bytes | bytearray | str,
        sig_header: str | None,
        secret: str | None,
        *,
        tolerance: int = WEBHOOK_TOLERANCE_SECONDS,
        now: float | None = None,
    ) -> dict[str, Any]:
        """Verify X-KHQRPay-Signature against raw request bytes before parsing JSON.

        Meets Requirements 1, 2, and 3:
        1. Operates on the raw request body before any JSON parser touches it.
        2. Refuses every event if the signing secret is unset or empty, and compares
           HMAC-SHA256 signatures in constant time with `hmac.compare_digest`.
        3. Rejects timestamps more than `tolerance` seconds (default 300s / 5m) from current time.
        """
        cleaned_secret = (secret or "").strip()
        if not cleaned_secret:
            raise KHQRPayWebhookVerificationError("Webhook signing secret is unset or empty.")

        if raw_body is None:
            raise KHQRPayWebhookVerificationError("Missing raw request body.")
        if isinstance(raw_body, (bytes, bytearray)):
            raw_bytes = bytes(raw_body)
        elif isinstance(raw_body, str):
            raw_bytes = raw_body.encode("utf-8")
        else:
            raise KHQRPayWebhookVerificationError("raw_body must be bytes or str.")

        if not raw_bytes:
            raise KHQRPayWebhookVerificationError("Empty request body.")

        if not sig_header or not isinstance(sig_header, str) or not sig_header.strip():
            raise KHQRPayWebhookVerificationError("Missing X-KHQRPay-Signature header.")

        # Delegate to official khqrpay Python SDK when installed and using real wall-clock time.
        if (
            _khqrpay_sdk is not None
            and now is None
            and tolerance == WEBHOOK_TOLERANCE_SECONDS
            and hasattr(_khqrpay_sdk, "webhooks")
            and hasattr(_khqrpay_sdk.webhooks, "construct_event")
        ):
            try:
                sdk_event = _khqrpay_sdk.webhooks.construct_event(
                    raw_bytes,
                    sig_header,
                    cleaned_secret,
                )
                if isinstance(sdk_event, dict):
                    return sdk_event
            except Exception as exc:
                raise KHQRPayWebhookVerificationError(str(exc)) from exc

        timestamp_str: str | None = None
        v1_signatures: list[str] = []
        for part in sig_header.split(","):
            piece = part.strip()
            if not piece or "=" not in piece:
                raise KHQRPayWebhookVerificationError("Malformed X-KHQRPay-Signature header.")
            key, val = piece.split("=", 1)
            key = key.strip()
            val = val.strip()
            if not key or not val:
                raise KHQRPayWebhookVerificationError("Malformed X-KHQRPay-Signature field.")
            if key == "t":
                if timestamp_str is not None:
                    raise KHQRPayWebhookVerificationError("Duplicate timestamp in X-KHQRPay-Signature.")
                timestamp_str = val
            elif key == "v1":
                v1_signatures.append(val)

        if not timestamp_str or not v1_signatures:
            raise KHQRPayWebhookVerificationError("X-KHQRPay-Signature must contain t and v1.")

        try:
            timestamp = int(timestamp_str)
        except ValueError as exc:
            raise KHQRPayWebhookVerificationError("Invalid timestamp in X-KHQRPay-Signature.") from exc

        current_ts = float(now if now is not None else time.time())
        if abs(current_ts - timestamp) > tolerance:
            raise KHQRPayWebhookVerificationError("Webhook timestamp is outside the 5-minute tolerance window.")

        signed_payload = timestamp_str.encode("utf-8") + b"." + raw_bytes
        expected_sig = hmac.new(
            cleaned_secret.encode("utf-8"),
            signed_payload,
            hashlib.sha256,
        ).hexdigest()

        matched = False
        for candidate in v1_signatures:
            try:
                is_equal = hmac.compare_digest(expected_sig, candidate.lower())
            except TypeError:
                is_equal = False
            if is_equal:
                matched = True

        if not matched:
            raise KHQRPayWebhookVerificationError("Webhook signature verification failed.")

        try:
            decoded_text = raw_bytes.decode("utf-8")
            event = json.loads(decoded_text)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise KHQRPayWebhookVerificationError("Webhook body is not valid UTF-8 JSON.") from exc

        if not isinstance(event, dict) or not isinstance(event.get("id"), str) or not event.get("id", "").strip():
            raise KHQRPayWebhookVerificationError("Webhook event payload is missing a valid string id.")

        return event


webhooks = _WebhooksNamespace()


def _parse_retry_after(headers: dict[str, str]) -> int | None:
    for k, v in headers.items():
        if k.lower() == "retry-after":
            try:
                return max(0, int(float(str(v).strip())))
            except ValueError:
                return None
    return None


def _get_header_ci(headers: dict[str, str], target_name: str) -> str | None:
    target_lower = target_name.lower()
    for k, v in headers.items():
        if k.lower() == target_lower:
            return str(v).strip()
    return None


def _execute_khqrpay_http(
    method: str,
    path: str,
    *,
    api_key: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    base_url: str | None = None,
    timeout: float = 15.0,
) -> tuple[int, dict[str, Any], dict[str, str]]:
    """Low-level HTTPS request helper returning (status_code, json_body, response_headers)."""
    base = _get_base_url() if base_url is None else base_url.rstrip("/")
    if not base.lower().startswith("https://"):
        raise KHQRPayAPIError(
            "https_required",
            "KHQRPay API calls must use https://khqrpay.dev.",
            status_code=403,
        )

    url = f"{base}{path}"
    req_headers: dict[str, str] = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "User-Agent": "AgriSystem-KHQRPay/1.0",
    }
    if headers:
        req_headers.update(headers)

    body_bytes: bytes | None = None
    if payload is not None:
        req_headers["Content-Type"] = "application/json"
        body_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status_code = int(resp.status)
            resp_headers = {k: v for k, v in resp.headers.items()}
            raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw) if raw.strip() else {}
            return status_code, data, resp_headers
    except urllib.error.HTTPError as http_err:
        status_code = int(http_err.code)
        resp_headers = {k: v for k, v in http_err.headers.items()} if http_err.headers else {}
        raw = ""
        try:
            raw = http_err.read().decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001, S110
            pass
        try:
            err_body = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            err_body = {}
        error_code = str(err_body.get("error") or f"http_{status_code}")
        error_message = str(err_body.get("message") or f"HTTP {status_code}")
        raise KHQRPayAPIError(
            error_code,
            error_message,
            status_code=status_code,
            retry_after=_parse_retry_after(resp_headers),
            headers=resp_headers,
        ) from http_err
    except urllib.error.URLError as url_err:
        raise KHQRPayAPIError(
            "temporarily_unavailable",
            f"Network error contacting KHQRPay: {url_err.reason}",
            status_code=503,
        ) from url_err


def _request_with_retries(
    method: str,
    path: str,
    *,
    api_key: str,
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
    reference_id_for_new_key: str | None = None,
    base_url: str | None = None,
    max_retries: int = 2,
    allow_sleep: bool = False,
    sleep_fn=time.sleep,
    http_fn=_execute_khqrpay_http,
) -> tuple[int, dict[str, Any], dict[str, str], str | None]:
    """Execute a KHQRPay request with Requirement 9 & 10 rate-limit and retry semantics."""
    current_key = idempotency_key
    used_new_key_for_read_budget = False
    attempts = 0

    while True:
        req_headers: dict[str, str] = {}
        if current_key:
            req_headers["Idempotency-Key"] = current_key

        try:
            status_code, data, resp_headers = http_fn(
                method,
                path,
                api_key=api_key,
                payload=payload,
                headers=req_headers,
                base_url=base_url,
            )
            return status_code, data, resp_headers, current_key
        except KHQRPayAPIError as err:
            # Requirement 9 & 10 exception:
            # A create that repeats an Idempotency-Key when the day's read budget is
            # exhausted returns 429 rate_limited with X-ReadBudget-Remaining: 0.
            # Retrying with a new Idempotency-Key succeeds.
            read_budget_rem = _get_header_ci(err.headers, "X-ReadBudget-Remaining")
            if (
                method.upper() == "POST"
                and path == "/v1/payments"
                and err.status_code == 429
                and err.error_code == "rate_limited"
                and read_budget_rem == "0"
                and current_key is not None
                and not used_new_key_for_read_budget
            ):
                used_new_key_for_read_budget = True
                ref_prefix = reference_id_for_new_key or "order"
                current_key = build_attempt_idempotency_key(ref_prefix, f"fresh-{uuid4().hex[:10]}")
                continue

            if attempts >= max_retries:
                raise

            # Requirement 10: 429 rate_limited
            if err.status_code == 429 or err.error_code == "rate_limited":
                wait_seconds = err.retry_after
                if (
                    wait_seconds is None
                    or wait_seconds > MAX_INLINE_RETRY_AFTER_SECONDS
                    or not allow_sleep
                ):
                    # Hour-long or day-long limit (or inside an HTTP request): fail immediately.
                    raise
                attempts += 1
                sleep_fn(wait_seconds)
                continue

            # Requirement 10: 503 temporarily_unavailable, 502 payment_provider_error, 500 internal_error
            # Safe to retry with the same Idempotency-Key.
            if err.error_code in {"temporarily_unavailable", "payment_provider_error", "internal_error"} or err.status_code in {500, 502, 503}:
                wait_seconds = err.retry_after if err.retry_after is not None else 1
                if wait_seconds > MAX_INLINE_RETRY_AFTER_SECONDS or not allow_sleep:
                    if not allow_sleep and wait_seconds > 0 and err.status_code == 503:
                        raise
                else:
                    sleep_fn(wait_seconds)
                attempts += 1
                continue

            raise


def create_khqrpay_payment(
    *,
    amount: float | str | Decimal,
    reference_id: str | int,
    currency: str | None = "USD",
    metadata: dict[str, Any] | None = None,
    attempt: int | str | None = None,
    idempotency_key: str | None = None,
    user: User | None = None,
    billing_interval: str = "monthly",
    coupon_code: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    allow_sleep: bool = False,
    max_retries: int = 2,
    sleep_fn=time.sleep,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """Create a KHQRPay payment for an order and return checkout_url, qr_string, and expires_at.

    - Converts numeric `reference_id` to a string (up to 255 characters).
    - Sends one `Idempotency-Key` per checkout attempt (e.g. "INV-2048-attempt-1"), not per order.
    - Retries with a new `Idempotency-Key` if a repeated key returns `429 rate_limited`
      with `X-ReadBudget-Remaining: 0` (Requirements 9 & 10).
    - Persists a `PaymentTransaction` record when a database session / user is active.
    """
    secret_key = _get_secret_key(api_key)
    ref_str = str(reference_id).strip()
    if not ref_str or len(ref_str) > MAX_REFERENCE_ID_LENGTH:
        raise KHQRPayAPIError(
            "invalid_request",
            f"reference_id must be a non-empty string up to {MAX_REFERENCE_ID_LENGTH} characters.",
            status_code=400,
        )

    norm_currency = (currency or "USD").strip().upper()
    formatted_amount = format_khqrpay_amount(amount, norm_currency)
    clean_metadata = validate_metadata(metadata)
    attempt_key = build_attempt_idempotency_key(
        ref_str,
        attempt,
        idempotency_key=idempotency_key,
    )

    body: dict[str, Any] = {
        "amount": formatted_amount,
        "currency": norm_currency,
        "reference_id": ref_str,
    }
    if clean_metadata is not None:
        body["metadata"] = clean_metadata

    status_code, payment, _resp_headers, final_key = _request_with_retries(
        "POST",
        "/v1/payments",
        api_key=secret_key,
        payload=body,
        idempotency_key=attempt_key,
        reference_id_for_new_key=ref_str,
        base_url=base_url,
        max_retries=max_retries,
        allow_sleep=allow_sleep,
        sleep_fn=sleep_fn,
        http_fn=http_fn,
    )

    payment_id = str(payment.get("id") or "").strip()
    qr_string = payment.get("qr_string")
    checkout_url = payment.get("checkout_url")
    expires_at = payment.get("expires_at")
    qr_svg_url = build_khqr_svg_url(qr_string, base_url=base_url)

    tx_id: int | None = None
    if has_app_context() and user is not None and getattr(user, "id", None) and payment_id:
        existing_tx = PaymentTransaction.query.filter_by(md5=payment_id).first()
        if existing_tx is None:
            existing_tx = PaymentTransaction.query.filter_by(
                bill_number=ref_str,
                payment_method="KHQRPAY",
            ).first()

        meta_record = {
            "khqrpay_payment_id": payment_id,
            "livemode": bool(payment.get("livemode")),
            "requested_amount": payment.get("requested_amount") or formatted_amount,
            "requested_currency": payment.get("requested_currency") or norm_currency,
            "settlement_amount": payment.get("settlement_amount") or payment.get("amount"),
            "settlement_currency": payment.get("settlement_currency") or payment.get("currency"),
            "conversion_rate": payment.get("conversion_rate"),
            "expires_at": expires_at,
            "idempotency_key": final_key,
            "metadata": clean_metadata or {},
        }
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        if existing_tx is None:
            existing_tx = PaymentTransaction(
                user_id=user.id,
                payment_method="KHQRPAY",
                bill_number=ref_str,
                md5=payment_id,
                qr_string=qr_string,
                deeplink=checkout_url,
                amount=float(Decimal(formatted_amount)),
                currency=norm_currency,
                billing_interval=billing_interval,
                status="PENDING",
                coupon_code=coupon_code.strip().upper() if coupon_code else None,
                metadata_json=json.dumps(meta_record),
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.session.add(existing_tx)
        else:
            existing_tx.md5 = payment_id
            existing_tx.qr_string = qr_string
            existing_tx.deeplink = checkout_url
            existing_tx.metadata_json = json.dumps(meta_record)
            existing_tx.updated_at = now_dt
        db.session.commit()
        tx_id = existing_tx.id

    return {
        "success": True,
        "replayed": status_code == 200,
        "status_code": status_code,
        "idempotency_key": final_key,
        "transaction_id": tx_id,
        "payment_id": payment_id,
        "status": payment.get("status", "pending"),
        "livemode": bool(payment.get("livemode")),
        "amount": payment.get("amount", formatted_amount),
        "currency": payment.get("currency", norm_currency),
        "requested_amount": payment.get("requested_amount", formatted_amount),
        "requested_currency": payment.get("requested_currency", norm_currency),
        "settlement_amount": payment.get("settlement_amount", payment.get("amount", formatted_amount)),
        "settlement_currency": payment.get("settlement_currency", payment.get("currency", norm_currency)),
        "conversion_rate": payment.get("conversion_rate"),
        "reference_id": payment.get("reference_id", ref_str),
        "checkout_url": checkout_url,
        "qr_string": qr_string,
        "qr_svg_url": qr_svg_url,
        "expires_at": expires_at,
        "created_at": payment.get("created_at"),
        "payment": payment,
    }


def retrieve_khqrpay_payment(
    payment_id: str,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """Retrieve a single payment (`GET /v1/payments/:id`)."""
    pid = (payment_id or "").strip()
    if not pid:
        raise KHQRPayAPIError("invalid_request", "payment_id is required.", status_code=400)
    secret_key = _get_secret_key(api_key)
    _status, data, _headers, _key = _request_with_retries(
        "GET",
        f"/v1/payments/{quote(pid, safe='')}",
        api_key=secret_key,
        base_url=base_url,
        http_fn=http_fn,
    )
    return data


def list_khqrpay_payments(
    *,
    status: str | None = None,
    limit: int = 20,
    cursor: str | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """List payments (`GET /v1/payments`) with optional status filter and opaque cursor."""
    if not 1 <= int(limit) <= 100:
        raise KHQRPayAPIError("invalid_request", "limit must be between 1 and 100.", status_code=400)
    params: dict[str, str | int] = {"limit": int(limit)}
    if status:
        params["status"] = status.strip().lower()
    if cursor:
        params["cursor"] = cursor
    secret_key = _get_secret_key(api_key)
    query = urlencode(params)
    _status, data, _headers, _key = _request_with_retries(
        "GET",
        f"/v1/payments?{query}",
        api_key=secret_key,
        base_url=base_url,
        http_fn=http_fn,
    )
    return data


def get_khqrpay_usage(
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """Retrieve account quota and read-budget usage (`GET /v1/usage`)."""
    secret_key = _get_secret_key(api_key)
    _status, data, _headers, _key = _request_with_retries(
        "GET",
        "/v1/usage",
        api_key=secret_key,
        base_url=base_url,
        http_fn=http_fn,
    )
    return data


def simulate_khqrpay_test_payment(
    payment_id: str,
    status: str,
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """Drive a test payment through statuses (`POST /v1/test/payments/:id/simulate`, Requirement 11)."""
    secret_key = _get_secret_key(api_key)
    if not secret_key.startswith("kp_test_"):
        raise KHQRPayAPIError(
            "invalid_request",
            "Simulation endpoint is only available with kp_test_ keys.",
            status_code=400,
        )
    norm_status = (status or "").strip().lower()
    if norm_status not in {"scanned", "paid", "expired", "failed"}:
        raise KHQRPayAPIError(
            "invalid_status",
            "Simulated status must be one of: scanned, paid, expired, failed.",
            status_code=400,
        )
    pid = (payment_id or "").strip()
    if not pid:
        raise KHQRPayAPIError("invalid_request", "payment_id is required.", status_code=400)
    _code, data, _headers, _key = _request_with_retries(
        "POST",
        f"/v1/test/payments/{quote(pid, safe='')}/simulate",
        api_key=secret_key,
        payload={"status": norm_status},
        base_url=base_url,
        http_fn=http_fn,
    )
    return data


def check_expired_payment_before_cancel(
    payment_id: str,
    *,
    expires_at: str | datetime | None = None,
    now_dt: datetime | None = None,
    api_key: str | None = None,
    base_url: str | None = None,
    http_fn=_execute_khqrpay_http,
) -> dict[str, Any]:
    """Enforce Requirement 8 before irreversibly cancelling an expired order.

    - Does not treat `expired` as final until 1 hour after `expires_at`.
    - Re-reads `GET /v1/payments/:id` before cancelling and checks `monitoring_gap`.
    - If `monitoring_gap` is true and status isn't `paid`, treats the payment as
      `unknown` (merchant must check their ABA app) rather than `unpaid`.
    """
    now = now_dt or datetime.now(timezone.utc).replace(tzinfo=None)
    exp_dt = expires_at if isinstance(expires_at, datetime) else parse_iso_datetime(expires_at)

    if exp_dt is not None:
        final_cutoff = exp_dt + timedelta(seconds=LATE_EXPIRY_GRACE_SECONDS)
        if now < final_cutoff:
            remaining_grace = int((final_cutoff - now).total_seconds())
            return {
                "can_cancel": False,
                "resolution": "grace_period_active",
                "remaining_grace_seconds": remaining_grace,
                "message": "Do not treat expired as final until 1 hour after expires_at.",
            }

    payment = retrieve_khqrpay_payment(
        payment_id,
        api_key=api_key,
        base_url=base_url,
        http_fn=http_fn,
    )
    remote_status = str(payment.get("status") or "").lower()
    monitoring_gap = bool(payment.get("monitoring_gap"))

    if remote_status == "paid":
        return {
            "can_cancel": False,
            "resolution": "paid",
            "monitoring_gap": monitoring_gap,
            "payment": payment,
            "message": "Payment was approved; fulfil the order instead of cancelling.",
        }

    # Re-check expires_at from the freshly retrieved payment object if not passed in
    if exp_dt is None:
        remote_exp = parse_iso_datetime(payment.get("expires_at"))
        if remote_exp is not None and now < remote_exp + timedelta(seconds=LATE_EXPIRY_GRACE_SECONDS):
            remaining_grace = int(((remote_exp + timedelta(seconds=LATE_EXPIRY_GRACE_SECONDS)) - now).total_seconds())
            return {
                "can_cancel": False,
                "resolution": "grace_period_active",
                "remaining_grace_seconds": remaining_grace,
                "monitoring_gap": monitoring_gap,
                "payment": payment,
                "message": "Do not treat expired as final until 1 hour after expires_at.",
            }

    if monitoring_gap:
        return {
            "can_cancel": False,
            "resolution": "unknown",
            "monitoring_gap": True,
            "payment": payment,
            "message": "Payment had a monitoring gap; treat as unknown and verify in the ABA app before cancelling.",
        }

    return {
        "can_cancel": remote_status in {"expired", "failed"},
        "resolution": remote_status or "unpaid",
        "monitoring_gap": False,
        "payment": payment,
    }


def _amounts_match(expected_amount: float | Decimal | str, actual_amount: str | float | None, currency: str) -> bool:
    if actual_amount is None:
        return False
    try:
        expected_str = format_khqrpay_amount(expected_amount, currency)
        actual_str = format_khqrpay_amount(actual_amount, currency)
        return expected_str == actual_str
    except KHQRPayAPIError:
        return False


def _dispatch_async_post_fulfilment(
    app_obj,
    *,
    user_id: int,
    username: str,
    tx_id: int,
    bill_number: str,
    payment_id: str,
    amount: float,
    currency: str,
    billing_interval: str,
    expires_date_str: str,
    is_late: bool,
) -> None:
    """Run slow post-payment notifications and audit logging asynchronously (Requirement 4)."""

    def _worker() -> None:
        try:
            with app_obj.app_context():
                try:
                    from app.services.notification_service import notify_user

                    notify_user(
                        user_id=user_id,
                        kind="premium_upgrade",
                        title="KHQRPay Payment Approved! 👑",
                        subtitle=(
                            f"Your {billing_interval.capitalize()} VIP Pro membership is active until "
                            f"{expires_date_str}."
                        ),
                        url="/farmer/dashboard",
                        icon="fas fa-crown",
                        level="success",
                    )
                except Exception as notify_err:  # noqa: BLE001
                    logger.debug(f"Async KHQRPay notification skipped: {notify_err}")

                try:
                    from app.services.audit_service import log_action

                    late_tag = " [late=true]" if is_late else ""
                    log_action(
                        "khqrpay_payment_success",
                        detail=(
                            f"User @{username} paid {amount:.2f} {currency} via KHQRPay{late_tag} "
                            f"(Order: {bill_number}, Payment: {payment_id}, Tx: #{tx_id}, Interval: {billing_interval})"
                        ),
                    )
                except Exception as audit_err:  # noqa: BLE001
                    logger.debug(f"Async KHQRPay audit log skipped: {audit_err}")
        except Exception as outer_err:  # noqa: BLE001
            logger.debug(f"Async KHQRPay post-fulfilment worker note: {outer_err}")

    thread = threading.Thread(target=_worker, name=f"khqrpay-fulfil-{tx_id}", daemon=True)
    thread.start()


def _find_order_transaction(payment_data: dict[str, Any]) -> PaymentTransaction | None:
    payment_id = str(payment_data.get("id") or "").strip()
    reference_id = str(payment_data.get("reference_id") or "").strip()

    tx: PaymentTransaction | None = None
    if payment_id:
        tx = PaymentTransaction.query.filter_by(md5=payment_id).first()
    if tx is None and reference_id:
        tx = (
            PaymentTransaction.query.filter_by(bill_number=reference_id)
            .order_by(PaymentTransaction.created_at.desc())
            .first()
        )
    return tx


def _fulfil_completed_payment(tx: PaymentTransaction, payment_data: dict[str, Any], *, run_async_tasks: bool = True) -> tuple[bool, str]:
    """Fulfil a matched order on `payment.completed` (Requirements 6 & 8).

    - Checks the order's priced currency and amount against `requested_amount` and
      `requested_currency` (falling back to `amount` and `currency` only when
      `requested_*` are null on legacy payments).
    - Honours `payment.completed` even if `tx.status` was previously `"EXPIRED"`
      (including when `data.payment.late = True`).
    """
    if tx.status == "PAID":
        return False, "already_paid"

    expected_currency = (tx.currency or "USD").strip().upper()
    req_currency = payment_data.get("requested_currency")
    check_currency = (
        str(req_currency).strip().upper()
        if req_currency is not None and str(req_currency).strip()
        else str(payment_data.get("currency") or "").strip().upper()
    )
    req_amount = payment_data.get("requested_amount")
    check_amount = req_amount if req_amount is not None else payment_data.get("amount")

    if check_currency != expected_currency or not _amounts_match(tx.amount, check_amount, expected_currency):
        logger.warning(
            "KHQRPay currency/amount mismatch for order %s: expected %s %s, got %s %s",
            tx.bill_number,
            tx.amount,
            expected_currency,
            check_amount,
            check_currency,
        )
        return False, "amount_or_currency_mismatch"

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    approved_dt = parse_iso_datetime(payment_data.get("approved_at")) or now_dt
    tx.status = "PAID"
    tx.paid_at = approved_dt
    tx.updated_at = now_dt
    if payment_data.get("id") and not tx.md5:
        tx.md5 = str(payment_data["id"]).strip()

    # Record late and monitoring_gap flags in metadata_json
    try:
        meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
    except json.JSONDecodeError:
        meta = {}
    meta.update({
        "khqrpay_payment_id": payment_data.get("id"),
        "status": "paid",
        "late": bool(payment_data.get("late")),
        "monitoring_gap": bool(payment_data.get("monitoring_gap")),
        "settlement_amount": payment_data.get("settlement_amount") or payment_data.get("amount"),
        "settlement_currency": payment_data.get("settlement_currency") or payment_data.get("currency"),
        "conversion_rate": payment_data.get("conversion_rate"),
        "approved_at": payment_data.get("approved_at"),
    })
    tx.metadata_json = json.dumps(meta)

    if tx.coupon_code:
        coupon = PremiumCoupon.query.filter_by(code=tx.coupon_code).first()
        if coupon and coupon.is_valid()[0]:
            coupon.times_used += 1

    days_to_add = 365 if tx.billing_interval == "yearly" else 30
    user = tx.user or db.session.get(User, tx.user_id)
    expires_date_str = ""
    username = "farmer"
    if user is not None:
        user.is_premium = True
        if user.premium_expires_at and user.premium_expires_at > now_dt:
            user.premium_expires_at = user.premium_expires_at + timedelta(days=days_to_add)
        else:
            user.premium_expires_at = now_dt + timedelta(days=days_to_add)
        expires_date_str = user.premium_expires_at.strftime("%Y-%m-%d")
        username = user.username or "farmer"

    db.session.commit()

    if run_async_tasks and has_app_context() and user is not None:
        app_obj = current_app._get_current_object()  # type: ignore[attr-defined]
        _dispatch_async_post_fulfilment(
            app_obj,
            user_id=user.id,
            username=username,
            tx_id=tx.id,
            bill_number=tx.bill_number,
            payment_id=str(payment_data.get("id") or tx.md5 or ""),
            amount=float(tx.amount or 0.0),
            currency=expected_currency,
            billing_interval=tx.billing_interval,
            expires_date_str=expires_date_str,
            is_late=bool(payment_data.get("late")),
        )

    return True, "fulfilled"


def process_khqrpay_webhook(
    raw_body: bytes | bytearray | str,
    sig_header: str | None,
    *,
    webhook_secret: str | None = None,
    event_header: str | None = None,
    delivery_header: str | None = None,
    tolerance: int = WEBHOOK_TOLERANCE_SECONDS,
    now: float | None = None,
    run_async_tasks: bool = True,
) -> tuple[int, dict[str, Any]]:
    """Verify and process an incoming KHQRPay webhook event (Requirements 1 to 8).

    Returns `(http_status_code, response_dict)`.
    """
    secret = _get_webhook_secret(webhook_secret)
    try:
        event = webhooks.construct_event(
            raw_body,
            sig_header,
            secret,
            tolerance=tolerance,
            now=now,
        )
    except KHQRPayWebhookVerificationError as exc:
        return 400, {"error": "invalid_signature", "message": str(exc)}

    event_id = str(event.get("id") or "").strip()
    event_type = str(event.get("type") or event_header or "").strip()
    if not event_id or not event_type:
        return 400, {"error": "invalid_request", "message": "Webhook event must include id and type."}

    data_obj = event.get("data")
    payment_data = data_obj.get("payment") if isinstance(data_obj, dict) else None
    if not isinstance(payment_data, dict):
        return 400, {"error": "invalid_request", "message": "Webhook event is missing data.payment."}

    payment_id = str(payment_data.get("id") or "").strip() or None
    reference_id = str(payment_data.get("reference_id") or "").strip() or None
    livemode = bool(event.get("livemode"))
    is_test = bool(event.get("test"))

    # Requirement 5: Deduplicate on the event id (the body's "id"), never on the payment id.
    existing_event = KHQRPayWebhookEvent.query.filter_by(event_id=event_id).first()
    if existing_event is not None:
        return 200, {
            "received": True,
            "duplicate": True,
            "event_id": event_id,
            "fulfilled": False,
        }

    raw_text = (
        raw_body.decode("utf-8", errors="replace")
        if isinstance(raw_body, (bytes, bytearray))
        else str(raw_body)
    )
    webhook_record = KHQRPayWebhookEvent(
        event_id=event_id,
        event_type=event_type,
        payment_id=payment_id,
        reference_id=reference_id,
        livemode=livemode,
        is_test=is_test,
        delivery_id=(delivery_header or "").strip() or None,
        payload_json=raw_text,
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.session.add(webhook_record)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return 200, {
            "received": True,
            "duplicate": True,
            "event_id": event_id,
            "fulfilled": False,
        }

    # Requirement 7: If livemode is false or test is true, answer 2xx and fulfil nothing.
    if not livemode or is_test:
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "test_or_non_live_event",
        }

    # Payment made through a payment link has reference_id "link:<id>": answer 2xx if it isn't one of our orders.
    if reference_id and reference_id.startswith("link:"):
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "payment_link_ignored",
        }

    tx = _find_order_transaction(payment_data)
    if tx is None:
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "order_not_found",
        }

    # Update monitoring_gap metadata if present on any event
    if payment_data.get("monitoring_gap") is not None:
        try:
            meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
        except json.JSONDecodeError:
            meta = {}
        meta["monitoring_gap"] = bool(payment_data.get("monitoring_gap"))
        tx.metadata_json = json.dumps(meta)

    # Requirement 6 & 8: Fulfil the order ONLY on payment.completed (including late=true after payment.expired).
    if event_type == "payment.completed":
        fulfilled, reason = _fulfil_completed_payment(tx, payment_data, run_async_tasks=run_async_tasks)
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": fulfilled,
            "late": bool(payment_data.get("late")),
            "reason": reason,
        }

    if event_type == "payment.scanned":
        # Never fulfil on payment.scanned.
        if tx.status == "PENDING":
            tx.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.session.commit()
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "scanned",
        }

    if event_type == "payment.expired":
        # Mark EXPIRED if not already PAID, but keep non-final for 1h so late payment.completed can still fulfil.
        if tx.status != "PAID":
            tx.status = "EXPIRED"
            tx.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.session.commit()
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "expired",
        }

    if event_type == "payment.failed":
        if tx.status != "PAID":
            tx.status = "FAILED"
            tx.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.session.commit()
        return 200, {
            "received": True,
            "duplicate": False,
            "event_id": event_id,
            "fulfilled": False,
            "reason": "failed",
        }

    return 200, {
        "received": True,
        "duplicate": False,
        "event_id": event_id,
        "fulfilled": False,
        "reason": "unhandled_event_type",
    }
