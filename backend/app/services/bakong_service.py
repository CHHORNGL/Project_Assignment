import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from bakong_khqr import KHQR
from flask import current_app, has_app_context

from app.extensions import db
from app.models.payment_transaction import PaymentTransaction
from app.models.premium_coupon import PremiumCoupon
from app.models.site_setting import SiteSetting
from app.models.user import User

logger = logging.getLogger(__name__)

KHQR_EXPIRY_SECONDS = 180


def _use_khqrpay() -> bool:
    """Return True when KHQRPay (https://khqrpay.dev) is configured and active."""
    key = ""
    if has_app_context():
        if current_app.config.get("TESTING") and not current_app.config.get("KHQRPAY_ENABLED_IN_TESTS"):
            return False
        key = str(current_app.config.get("KHQRPAY_SECRET_KEY") or "").strip()
    if not key:
        key = os.getenv("KHQRPAY_SECRET_KEY", "").strip()
    return bool(key)


def compute_khqr_expiry(
    tx: PaymentTransaction, now_dt: datetime | None = None
) -> tuple[datetime, int]:
    """Return UTC naive expiration timestamp and clamped remaining seconds for a KHQR payment.

    When the transaction was created via KHQRPay, re-reads `expires_at` from `metadata_json`
    (which KHQRPay updates dynamically when scanned) instead of hard-coding a duration.
    """
    now = now_dt or datetime.now(timezone.utc).replace(tzinfo=None)
    created = tx.created_at or now
    expires_at: datetime | None = None
    if tx.metadata_json:
        try:
            from app.services.khqrpay_service import parse_iso_datetime

            meta = json.loads(tx.metadata_json)
            if isinstance(meta, dict) and meta.get("expires_at"):
                expires_at = parse_iso_datetime(str(meta["expires_at"]))
        except (ValueError, TypeError):
            expires_at = None
    if expires_at is None:
        expires_at = created + timedelta(seconds=KHQR_EXPIRY_SECONDS)
    remaining = max(0, int((expires_at - now).total_seconds()))
    return expires_at, remaining


def get_bakong_config() -> dict[str, str]:
    """
    Retrieve KHQRPay / Bakong KHQR settings from SiteSetting database or fall back to environment variables.
    """
    def _val(key: str, env_key: str, default: str = "") -> str:
        s = db.session.get(SiteSetting, key)
        if s and s.value and s.value.strip():
            return s.value.strip()
        return os.getenv(env_key, default).strip()

    return {
        "provider": "khqrpay" if _use_khqrpay() else "bakong",
        "payment_link": _val("khqrpay_payment_link", "KHQRPAY_PAYMENT_LINK", "https://khqrpay.dev/l/hhybpkw5vd"),
        "token": _val(
            "bakong_token",
            "BAKONG_TOKEN",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImlkIjoiZDcwMjUxZGM4NTQ1NGMzNCJ9LCJpYXQiOjE3OTEwNDg4NzQsImV4cCI6MTc5ODgyNDg3NH0.XQXkwMI-Ss5NFVvE2WviF3K89YKe9bhCiLWrCtKxWF8",
        ),
        "account_id": _val("bakong_account_id", "BAKONG_ACCOUNT_ID", "seavik_mao@bkrt"),
        "merchant_name": _val("bakong_merchant_name", "BAKONG_MERCHANT_NAME", "Seavik Mao"),
        "merchant_city": _val("bakong_merchant_city", "BAKONG_MERCHANT_CITY", "Phnom Penh"),
        "currency": _val("bakong_currency", "BAKONG_CURRENCY", "USD").upper(),
        "store_label": _val("bakong_store_label", "BAKONG_STORE_LABEL", "Agri System Pro"),
    }


def get_khqr_client() -> KHQR:
    """
    Initialize the KHQR SDK client with the configured Bakong token.
    """
    config = get_bakong_config()
    return KHQR(bakong_token=config["token"])


def generate_clean_khqr_image(qr_string: str, currency: str = "USD") -> str | None:
    """
    Generate an ultra-crisp, professional QR code image with the central Bakong currency badge,
    sized and padded perfectly for in-app checkout display without redundant outer card framing.
    """
    try:
        import base64
        import io
        from importlib import resources

        import qrcode
        from PIL import Image, ImageDraw

        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=12,
            border=2,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert("RGBA")

        asset_name = "USD.png" if (currency or "USD").upper() == "USD" else "KHR.png"
        try:
            icon_bytes = resources.files("bakong_khqr.sdk.assets").joinpath(asset_name).read_bytes()
            icon = Image.open(io.BytesIO(icon_bytes)).convert("RGBA")
        except Exception:  # noqa: BLE001
            icon_bytes = resources.files("bakong_khqr.sdk.assets").joinpath("khqr.png").read_bytes()
            icon = Image.open(io.BytesIO(icon_bytes)).convert("RGBA")

        qr_w, qr_h = img.size
        icon_w = max(24, int(qr_w * 0.22))
        icon_h = icon_w
        icon = icon.resize((icon_w, icon_h), Image.Resampling.LANCZOS)

        pad = max(4, int(icon_w * 0.14))
        badge_size = icon_w + pad * 2
        badge = Image.new("RGBA", (badge_size, badge_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(badge)
        draw.rounded_rectangle(
            [0, 0, badge_size, badge_size],
            radius=int(badge_size * 0.28),
            fill=(255, 255, 255, 255),
            outline=(225, 36, 42, 230),
            width=2,
        )
        badge.paste(icon, (pad, pad), icon)

        offset = ((qr_w - badge_size) // 2, (qr_h - badge_size) // 2)
        img.paste(badge, offset, badge)

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to generate clean KHQR image: {e}")
        return None


def serialize_khqr_transaction(
    tx: PaymentTransaction,
    now_dt: datetime | None = None,
    *,
    config: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build the checkout KHQR response payload from an existing PaymentTransaction."""
    cfg = config or get_bakong_config()
    final_currency = (tx.currency or cfg["currency"]).upper()
    qr_str = tx.qr_string or ""
    qr_image_data_uri = generate_clean_khqr_image(qr_str, currency=final_currency) if qr_str else None
    if not qr_image_data_uri and qr_str:
        try:
            qr_image_data_uri = get_khqr_client().qr_image(qr_str, format="base64_uri")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to generate fallback QR image: {e}")
            qr_image_data_uri = None

    expires_at, remaining_seconds = compute_khqr_expiry(tx, now_dt)
    created_dt = tx.created_at or (now_dt or datetime.now(timezone.utc).replace(tzinfo=None))
    total_expiry_seconds = max(KHQR_EXPIRY_SECONDS, int((expires_at - created_dt).total_seconds()))
    qr_svg_url = None
    if qr_str and (tx.payment_method == "KHQRPAY" or _use_khqrpay()):
        from app.services.khqrpay_service import build_khqr_svg_url

        qr_svg_url = build_khqr_svg_url(qr_str)
        if not qr_image_data_uri:
            qr_image_data_uri = qr_svg_url

    return {
        "success": True,
        "provider": "khqrpay" if tx.payment_method == "KHQRPAY" else cfg.get("provider", "bakong"),
        "transaction_id": tx.id,
        "md5": tx.md5,
        "qr_image": qr_image_data_uri,
        "qr_svg_url": qr_svg_url,
        "qr_string": qr_str,
        "deeplink": tx.deeplink,
        "checkout_url": tx.deeplink if tx.payment_method == "KHQRPAY" else None,
        "payment_link": cfg.get("payment_link"),
        "amount": round(float(tx.amount or 0.0), 2),
        "currency": final_currency,
        "bill_number": tx.bill_number,
        "merchant_name": cfg["merchant_name"],
        "account_id": tx.account_id or cfg["account_id"],
        "billing_interval": tx.billing_interval,
        "expires_in_seconds": total_expiry_seconds,
        "remaining_seconds": remaining_seconds,
        "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
    }


def reconcile_recent_user_khqr_payments(
    user: User,
    *,
    lookback_minutes: int = 60,
) -> dict[str, Any] | None:
    """
    Check the user's recent PENDING or EXPIRED KHQRPay / Bakong transactions.
    Prevents mobile users returning from their banking app from losing a completed payment
    if the browser tab reloaded or the 3-minute countdown elapsed while in the bank app.
    """
    if not user or not getattr(user, "id", None):
        return None

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now_dt - timedelta(minutes=max(1, lookback_minutes))
    recent_txs = (
        PaymentTransaction.query.filter(
            PaymentTransaction.user_id == user.id,
            PaymentTransaction.payment_method.in_(("KHQRPAY", "BAKONG_KHQR")),
            PaymentTransaction.status.in_(("PENDING", "EXPIRED", "PAID")),
            PaymentTransaction.created_at >= cutoff,
        )
        .order_by(PaymentTransaction.created_at.desc())
        .limit(3)
        .all()
    )

    for tx in recent_txs:
        if not tx.md5:
            continue
        if tx.status == "PAID":
            return verify_khqr_payment(tx.md5, enforce_expiry=False, bypass_cache=False)
        res = verify_khqr_payment(tx.md5, enforce_expiry=False, bypass_cache=True)
        if res.get("status") == "PAID":
            return res
    return None


def create_khqr_payment(
    user: User,
    amount: float,
    billing_interval: str = "monthly",
    coupon_code: str | None = None,
    currency: str | None = None,
    *,
    reuse_pending: bool = False,
) -> dict[str, Any]:
    """
    Create a KHQR payment (via KHQRPay https://khqrpay.dev when configured, or local Bakong SDK)
    and record the pending transaction.
    When reuse_pending=True, reuses an active matching PENDING transaction so mobile
    browser tab reloads while switching to/from a banking app do not overwrite the QR.
    """
    config = get_bakong_config()
    final_currency = (currency or config["currency"]).upper()
    amount_float = round(float(amount), 2)
    normalized_coupon = coupon_code.strip().upper() if coupon_code else None
    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    use_khqrpay = _use_khqrpay()

    if reuse_pending and user and getattr(user, "id", None):
        active_cutoff = now_dt - timedelta(seconds=KHQR_EXPIRY_SECONDS - 30)
        existing_tx = (
            PaymentTransaction.query.filter(
                PaymentTransaction.user_id == user.id,
                PaymentTransaction.payment_method.in_(("KHQRPAY", "BAKONG_KHQR")),
                PaymentTransaction.status == "PENDING",
                PaymentTransaction.billing_interval == billing_interval,
                PaymentTransaction.currency == final_currency,
                PaymentTransaction.coupon_code == normalized_coupon,
                PaymentTransaction.created_at > active_cutoff,
            )
            .order_by(PaymentTransaction.created_at.desc())
            .first()
        )
        if existing_tx and round(float(existing_tx.amount or 0.0), 2) == amount_float and existing_tx.qr_string:
            _exp, rem_sec = compute_khqr_expiry(existing_tx, now_dt)
            if rem_sec > 30:
                return serialize_khqr_transaction(existing_tx, now_dt, config=config)

    bill_number = f"BILL{user.id}{int(time.time())}"[-25:]

    if use_khqrpay:
        from app.services.khqrpay_service import KHQRPayAPIError, create_khqrpay_payment

        stale_cutoff = now_dt - timedelta(seconds=KHQR_EXPIRY_SECONDS)
        PaymentTransaction.query.filter(
            PaymentTransaction.user_id == user.id,
            PaymentTransaction.status == "PENDING",
            PaymentTransaction.created_at <= stale_cutoff,
        ).update({PaymentTransaction.status: "EXPIRED"}, synchronize_session=False)

        try:
            khqrpay_res = create_khqrpay_payment(
                amount=amount_float,
                currency=final_currency,
                reference_id=bill_number,
                attempt=1,
                metadata={
                    "user_id": str(user.id),
                    "username": str(user.username or ""),
                    "billing_interval": billing_interval,
                    "coupon_code": normalized_coupon or "",
                },
                user=user,
                billing_interval=billing_interval,
                coupon_code=normalized_coupon,
            )
        except KHQRPayAPIError as err:
            logger.error("Failed to create KHQRPay payment (%s): %s", err.error_code, err.message)
            return {
                "success": False,
                "error": err.error_code,
                "message": f"Unable to create KHQRPay payment ({err.error_code}): {err.message}",
            }

        tx_obj = db.session.get(PaymentTransaction, khqrpay_res["transaction_id"]) if khqrpay_res.get("transaction_id") else None
        if tx_obj is not None:
            serialized = serialize_khqr_transaction(tx_obj, now_dt, config=config)
            serialized.update({
                "checkout_url": khqrpay_res.get("checkout_url"),
                "qr_svg_url": khqrpay_res.get("qr_svg_url"),
                "requested_amount": khqrpay_res.get("requested_amount"),
                "requested_currency": khqrpay_res.get("requested_currency"),
                "settlement_amount": khqrpay_res.get("settlement_amount"),
                "settlement_currency": khqrpay_res.get("settlement_currency"),
                "conversion_rate": khqrpay_res.get("conversion_rate"),
            })
            return serialized

    client = get_khqr_client()
    try:
        res = client.create_qr(
            amount=amount_float,
            account_id=config["account_id"],
            merchant_name=config["merchant_name"],
            merchant_city=config["merchant_city"],
            currency=final_currency,
            store_label=config["store_label"],
            bill_number=bill_number,
        )
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to generate Bakong KHQR: {e}")
        return {
            "success": False,
            "message": f"Unable to generate Bakong QR code: {e!s}",
        }

    # Generate clean, high-resolution QR image for UI display
    qr_image_data_uri = generate_clean_khqr_image(str(res), currency=final_currency)
    if not qr_image_data_uri:
        try:
            qr_image_data_uri = client.qr_image(str(res), format="base64_uri")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to generate fallback QR image: {e}")
            qr_image_data_uri = None

    # Generate Bakong mobile banking deep link
    try:
        deeplink = client.generate_deeplink(
            str(res),
            appName="AgriSystemPro",
            appIconUrl="https://bakong.nbc.gov.kh/images/logo.svg",
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to generate deep link: {e}")
        deeplink = None

    # Safely extract md5
    res_md5 = getattr(res, "md5", None)
    if not res_md5 and isinstance(res, dict):
        res_md5 = res.get("md5")

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    stale_cutoff = now_dt - timedelta(seconds=KHQR_EXPIRY_SECONDS)
    PaymentTransaction.query.filter(
        PaymentTransaction.user_id == user.id,
        PaymentTransaction.status == "PENDING",
        PaymentTransaction.created_at <= stale_cutoff,
    ).update({PaymentTransaction.status: "EXPIRED"}, synchronize_session=False)

    # Persist pending transaction
    tx = PaymentTransaction(
        user_id=user.id,
        payment_method="BAKONG_KHQR",
        bill_number=bill_number,
        md5=str(res_md5) if res_md5 else None,
        qr_string=str(res),
        deeplink=str(deeplink) if deeplink else None,
        amount=amount_float,
        currency=final_currency,
        billing_interval=billing_interval,
        status="PENDING",
        coupon_code=coupon_code.strip().upper() if coupon_code else None,
        account_id=config["account_id"],
        created_at=now_dt,
        updated_at=now_dt,
    )
    db.session.add(tx)
    db.session.commit()

    expires_at, remaining_seconds = compute_khqr_expiry(tx, now_dt)
    return {
        "success": True,
        "transaction_id": tx.id,
        "md5": str(res_md5) if res_md5 else None,
        "qr_image": qr_image_data_uri,
        "qr_string": str(res),
        "deeplink": deeplink,
        "amount": amount_float,
        "currency": final_currency,
        "bill_number": bill_number,
        "merchant_name": config["merchant_name"],
        "account_id": config["account_id"],
        "billing_interval": billing_interval,
        "expires_in_seconds": KHQR_EXPIRY_SECONDS,
        "remaining_seconds": remaining_seconds,
        "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
    }


# Cache to prevent burning NBC daily limits (100 req/day): {md5: (timestamp, status_str, data, err_msg)}
_MD5_STATUS_CACHE: dict[str, tuple[float, str, dict, str]] = {}
CACHE_TTL_SECONDS = 3.0


def query_bakong_md5_api(
    token: str, md5: str, *, bypass_cache: bool = False
) -> tuple[str, dict, str]:
    """
    Directly query Bakong /check_transaction_by_md5 to parse responseCode, errorCode, and message accurately.
    Returns: (status_str, data_dict, error_message)
    """
    import http.client
    import json

    now = time.time()
    if not bypass_cache and md5 in _MD5_STATUS_CACHE:
        cached_time, cached_status, cached_data, cached_msg = _MD5_STATUS_CACHE[md5]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_status, cached_data, cached_msg

    is_relay = bool(token and token.startswith("rbk"))
    host = "api.khqr.dev" if is_relay else "api-bakong.nbc.gov.kh"
    path = "/v1/check_transaction_by_md5"

    conn = http.client.HTTPSConnection(host, timeout=10)
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "bakong-khqr/0.6.5 (+https://agricultureexp.com)",
        }
        conn.request("POST", path, body=json.dumps({"md5": md5}), headers=headers)
        resp = conn.getresponse()
        resp_data = resp.read().decode("utf-8")
        try:
            res_json = json.loads(resp_data)
        except json.JSONDecodeError:
            res_json = {"responseCode": 1, "responseMessage": f"Invalid JSON: {resp_data}"}
    except Exception as e:  # noqa: BLE001
        res_json = {"responseCode": 1, "responseMessage": f"Network error: {e}"}
    finally:
        conn.close()

    resp_code = res_json.get("responseCode")
    err_code = res_json.get("errorCode")
    err_msg = str(res_json.get("responseMessage", ""))
    data = res_json.get("data") if isinstance(res_json.get("data"), dict) else {}

    if resp_code == 0:
        status_str = "PAID"
    elif err_code == 17 or "daily request limit" in err_msg.lower():
        status_str = "RATE_LIMITED"
    elif err_code == 3 or "not found" in err_msg.lower():
        status_str = "UNPAID"
    else:
        status_str = "UNPAID"

    _MD5_STATUS_CACHE[md5] = (now, status_str, data, err_msg)
    return status_str, data, err_msg


def verify_khqr_payment(
    md5: str,
    *,
    enforce_expiry: bool = True,
    bypass_cache: bool = False,
) -> dict[str, Any]:
    """
    Check the transaction status with Bakong NBC, enforce 3-minute session expiry, and upgrade user if paid.
    """
    if not md5:
        return {"success": False, "status": "ERROR", "message": "MD5 hash is required."}

    tx = PaymentTransaction.query.filter_by(md5=md5).first()
    if not tx:
        return {"success": False, "status": "NOT_FOUND", "message": "Transaction not found."}

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    expires_at, remaining_seconds = compute_khqr_expiry(tx, now_dt)
    expiry_meta = {
        "expires_in_seconds": KHQR_EXPIRY_SECONDS,
        "remaining_seconds": remaining_seconds,
        "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
    }

    # If already verified (e.g. fulfilled by POST /api/webhooks/khqrpay)
    if tx.status == "PAID":
        return {
            "success": True,
            "status": "PAID",
            "message": "Payment has already been confirmed.",
            "transaction": tx.to_dict(),
            **expiry_meta,
        }

    # KHQRPay transaction status verification (`GET https://khqrpay.dev/v1/payments/:id`)
    if tx.payment_method == "KHQRPAY" or (_use_khqrpay() and str(md5).startswith("pay_")):
        from app.services.khqrpay_service import (
            KHQRPayAPIError,
            _fulfil_completed_payment,
            _get_secret_key,
            retrieve_khqrpay_payment,
        )

        now_ts = time.time()
        if not bypass_cache and md5 in _MD5_STATUS_CACHE:
            cached_time, cached_status, _cached_data, cached_msg = _MD5_STATUS_CACHE[md5]
            if now_ts - cached_time < CACHE_TTL_SECONDS and cached_status != "PAID":
                if enforce_expiry and remaining_seconds <= 0:
                    if tx.status != "EXPIRED":
                        tx.status = "EXPIRED"
                        db.session.commit()
                    return {
                        "success": False,
                        "status": "EXPIRED",
                        "message": "KHQR session expired. Please generate a new QR code.",
                        "transaction": tx.to_dict(),
                        **expiry_meta,
                        "remaining_seconds": 0,
                    }
                return {
                    "success": cached_status != "RATE_LIMITED",
                    "status": cached_status,
                    "message": cached_msg or "Payment is waiting for confirmation.",
                    "transaction": tx.to_dict(),
                    **expiry_meta,
                }

        try:
            payment_obj = retrieve_khqrpay_payment(md5)
            remote_status = str(payment_obj.get("status") or "pending").lower()

            # Re-read expires_at and monitoring_gap from KHQRPay (a scan extends expires_at by >= 2 minutes)
            try:
                meta = json.loads(tx.metadata_json) if tx.metadata_json else {}
            except json.JSONDecodeError:
                meta = {}
            if payment_obj.get("expires_at"):
                meta["expires_at"] = payment_obj["expires_at"]
            if payment_obj.get("monitoring_gap") is not None:
                meta["monitoring_gap"] = bool(payment_obj.get("monitoring_gap"))
            meta["status"] = remote_status
            tx.metadata_json = json.dumps(meta)
            db.session.commit()

            expires_at, remaining_seconds = compute_khqr_expiry(tx, now_dt)
            created_dt = tx.created_at or now_dt
            expiry_meta = {
                "expires_in_seconds": max(KHQR_EXPIRY_SECONDS, int((expires_at - created_dt).total_seconds())),
                "remaining_seconds": remaining_seconds,
                "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
            }

            if remote_status == "paid":
                secret_key = _get_secret_key()
                is_live_payment = bool(payment_obj.get("livemode"))
                if is_live_payment or secret_key.startswith("kp_test_"):
                    fulfilled, reason = _fulfil_completed_payment(tx, payment_obj)
                    if fulfilled or tx.status == "PAID":
                        _MD5_STATUS_CACHE[md5] = (now_ts, "PAID", payment_obj, "Payment confirmed.")
                        return {
                            "success": True,
                            "status": "PAID",
                            "message": "Payment verified successfully! Your account has been upgraded.",
                            "transaction": tx.to_dict(),
                            **expiry_meta,
                        }
                    err_msg = f"Payment verification rejected ({reason})."
                else:
                    err_msg = "Test payment ignored in live mode."
                status_str = "UNPAID"
            elif remote_status in {"expired", "failed"}:
                tx.status = "EXPIRED" if remote_status == "expired" else "FAILED"
                db.session.commit()
                _MD5_STATUS_CACHE[md5] = (now_ts, "EXPIRED", payment_obj, "KHQR expired.")
                return {
                    "success": False,
                    "status": "EXPIRED",
                    "message": "KHQR session expired. Please generate a new QR code.",
                    "transaction": tx.to_dict(),
                    **expiry_meta,
                    "remaining_seconds": 0,
                }
            elif remote_status == "scanned":
                status_str = "UNPAID"
                err_msg = "QR code scanned in bank app — waiting for payment confirmation."
            else:
                status_str = "UNPAID"
                err_msg = "Payment is waiting for confirmation."

            _MD5_STATUS_CACHE[md5] = (now_ts, status_str, payment_obj, err_msg)
        except KHQRPayAPIError as err:
            if err.error_code == "rate_limited" or err.status_code == 429:
                return {
                    "success": False,
                    "status": "RATE_LIMITED",
                    "message": "KHQRPay API rate limit reached. Please wait a moment and tap Verify Now, or contact support if you already paid.",
                    "transaction": tx.to_dict(),
                    **expiry_meta,
                }
            logger.warning("KHQRPay retrieve error for %s (%s): %s", md5, err.error_code, err.message)
            status_str = "UNPAID"
            err_msg = err.message

        if status_str != "PAID" and enforce_expiry and remaining_seconds <= 0:
            if tx.status != "EXPIRED":
                tx.status = "EXPIRED"
                db.session.commit()
            return {
                "success": False,
                "status": "EXPIRED",
                "message": "KHQR session expired. Please generate a new QR code.",
                "transaction": tx.to_dict(),
                **expiry_meta,
                "remaining_seconds": 0,
            }

        return {
            "success": True,
            "status": "UNPAID",
            "message": err_msg or "Payment is waiting for confirmation.",
            "transaction": tx.to_dict(),
            **expiry_meta,
        }

    if enforce_expiry and not bypass_cache and (tx.status == "EXPIRED" or (tx.status == "PENDING" and remaining_seconds <= 0)):
        if tx.status != "EXPIRED":
            tx.status = "EXPIRED"
            db.session.commit()
        return {
            "success": False,
            "status": "EXPIRED",
            "message": "Bakong KHQR session expired after 3 minutes. Please generate a new QR code.",
            "transaction": tx.to_dict(),
            **expiry_meta,
            "remaining_seconds": 0,
        }

    config = get_bakong_config()
    try:
        try:
            status_str, _data, err_msg = query_bakong_md5_api(
                config["token"], md5, bypass_cache=bypass_cache
            )
        except TypeError:
            status_str, _data, err_msg = query_bakong_md5_api(config["token"], md5)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Bakong query error for md5 {md5}: {e}")
        status_str = "UNPAID"
        err_msg = str(e)

    if status_str != "PAID" and enforce_expiry and (tx.status == "EXPIRED" or (tx.status == "PENDING" and remaining_seconds <= 0)):
        if tx.status != "EXPIRED":
            tx.status = "EXPIRED"
            db.session.commit()
        return {
            "success": False,
            "status": "EXPIRED",
            "message": "Bakong KHQR session expired after 3 minutes. Please generate a new QR code.",
            "transaction": tx.to_dict(),
            **expiry_meta,
            "remaining_seconds": 0,
        }

    if status_str == "PAID":
        now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
        tx.status = "PAID"
        tx.paid_at = now_dt

        # Update coupon usage if applicable
        if tx.coupon_code:
            coupon = PremiumCoupon.query.filter_by(code=tx.coupon_code).first()
            if coupon and coupon.is_valid()[0]:
                coupon.times_used += 1

        # Grant Premium access to user
        days_to_add = 365 if tx.billing_interval == "yearly" else 30
        user = tx.user
        if user:
            user.is_premium = True
            if user.premium_expires_at and user.premium_expires_at > now_dt:
                user.premium_expires_at = user.premium_expires_at + timedelta(days=days_to_add)
            else:
                user.premium_expires_at = now_dt + timedelta(days=days_to_add)

            # User notification
            try:
                from app.services.notification_service import notify_user
                notify_user(
                    user_id=user.id,
                    kind="premium_upgrade",
                    title="Bakong KHQR Payment Approved! 👑",
                    subtitle=(
                        f"Your {tx.billing_interval.capitalize()} VIP Pro membership is active until "
                        f"{user.premium_expires_at.strftime('%Y-%m-%d')}."
                    ),
                    url="/farmer/dashboard",
                    icon="fas fa-crown",
                    level="success",
                )
            except Exception as notify_err:  # noqa: BLE001
                logger.debug(f"Notification bypassed: {notify_err}")

            # Audit log
            try:
                from app.services.audit_service import log_action
                log_action(
                    "bakong_payment_success",
                    detail=(
                        f"User @{user.username} paid ${tx.amount:.2f} {tx.currency} via Bakong KHQR "
                        f"(Bill: {tx.bill_number}, MD5: {md5}, Interval: {tx.billing_interval})"
                    ),
                )
            except Exception as audit_err:  # noqa: BLE001
                logger.debug(f"Audit log bypassed: {audit_err}")

        db.session.commit()
        return {
            "success": True,
            "status": "PAID",
            "message": "Payment verified successfully! Your account has been upgraded.",
            "transaction": tx.to_dict(),
            **expiry_meta,
        }

    if status_str == "RATE_LIMITED":
        return {
            "success": False,
            "status": "RATE_LIMITED",
            "message": "Bakong NBC Developer daily limit reached (100 requests). If you already scanned and sent funds, please notify the administrator to approve your transaction.",
            "transaction": tx.to_dict(),
            **expiry_meta,
        }

    return {
        "success": True,
        "status": status_str if status_str in ("UNPAID", "PENDING", "EXPIRED") else "UNPAID",
        "message": err_msg or "Payment is waiting for confirmation.",
        "transaction": tx.to_dict(),
        **expiry_meta,
    }


def approve_khqr_transaction_manually(tx_id: int, admin_user=None) -> dict[str, Any]:
    """
    Manually approve a pending KHQR transaction and grant VIP access to the user.
    """
    tx = db.session.get(PaymentTransaction, tx_id)
    if not tx:
        return {"success": False, "message": "Transaction not found."}

    if tx.status == "PAID":
        return {"success": True, "message": "Transaction is already marked as PAID.", "transaction": tx.to_dict()}

    now_dt = datetime.now(timezone.utc).replace(tzinfo=None)
    tx.status = "PAID"
    tx.paid_at = now_dt

    # Update coupon usage if applicable
    if tx.coupon_code:
        coupon = PremiumCoupon.query.filter_by(code=tx.coupon_code).first()
        if coupon and coupon.is_valid()[0]:
            coupon.times_used += 1

    days_to_add = 365 if tx.billing_interval == "yearly" else 30
    user = tx.user
    if user:
        user.is_premium = True
        if user.premium_expires_at and user.premium_expires_at > now_dt:
            user.premium_expires_at = user.premium_expires_at + timedelta(days=days_to_add)
        else:
            user.premium_expires_at = now_dt + timedelta(days=days_to_add)

        try:
            from app.services.notification_service import notify_user
            notify_user(
                user_id=user.id,
                kind="premium_upgrade",
                title="Bakong KHQR Payment Approved! 👑",
                subtitle=(
                    f"Your {tx.billing_interval.capitalize()} VIP Pro membership has been confirmed and activated until "
                    f"{user.premium_expires_at.strftime('%Y-%m-%d')}."
                ),
                url="/farmer/dashboard",
                icon="fas fa-crown",
                level="success",
            )
        except Exception as notify_err:  # noqa: BLE001
            logger.debug(f"Notification bypassed: {notify_err}")

        try:
            from app.services.audit_service import log_action
            admin_name = getattr(admin_user, "username", "admin") if admin_user else "system"
            log_action(
                "bakong_payment_manual_approval",
                detail=(
                    f"Admin @{admin_name} manually approved ${tx.amount:.2f} {tx.currency} via Bakong KHQR for @{user.username} "
                    f"(Bill: {tx.bill_number}, ID: {tx.id}, Interval: {tx.billing_interval})"
                ),
            )
        except Exception as audit_err:  # noqa: BLE001
            logger.debug(f"Audit log bypassed: {audit_err}")

    db.session.commit()
    return {
        "success": True,
        "message": f"Transaction #{tx.id} for @{user.username if user else 'Unknown'} approved successfully!",
        "transaction": tx.to_dict(),
    }
