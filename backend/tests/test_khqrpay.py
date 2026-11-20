import hashlib
import hmac
import json
import os
import pathlib as _pathlib
import sys as _sys
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-khqrpay")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.khqrpay_webhook_event import KHQRPayWebhookEvent
from app.models.payment_transaction import PaymentTransaction
from app.models.role import Role
from app.models.user import User
from app.services.khqrpay_service import (
    KHQRPayAPIError,
    check_expired_payment_before_cancel,
    create_khqrpay_payment,
    simulate_khqrpay_test_payment,
)

TEST_WEBHOOK_SECRET = "whsec_dGVzdF9raHFycGF5X3dlYmhvb2tfc2VjcmV0X2tleQ"
TEST_API_KEY = "kp_test_51NzKhqrPayTestSecretKey0001"


def sign_khqrpay_payload(raw_body: bytes, secret: str = TEST_WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    ts = int(timestamp if timestamp is not None else time.time())
    signed_payload = f"{ts}.".encode() + raw_body
    digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


class TestKHQRPayIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY="test-secret-key-for-khqrpay",
            KHQRPAY_SECRET_KEY=TEST_API_KEY,
            KHQRPAY_WEBHOOK_SECRET=TEST_WEBHOOK_SECRET,
            KHQRPAY_BASE_URL="https://khqrpay.dev",
        ):
            cls.app = create_app()
        cls.app.config.update({
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "KHQRPAY_SECRET_KEY": TEST_API_KEY,
            "KHQRPAY_WEBHOOK_SECRET": TEST_WEBHOOK_SECRET,
            "KHQRPAY_BASE_URL": "https://khqrpay.dev",
        })
        cls.client = cls.app.test_client()

    @classmethod
    def tearDownClass(cls):
        try:
            os.close(_test_db_fd)
            os.unlink(_test_db_path)
        except OSError:
            pass

    def setUp(self):
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

        farmer_role = Role.query.filter_by(name="farmer").first()
        if not farmer_role:
            farmer_role = Role(name="farmer", route_type="farmer")
            db.session.add(farmer_role)
            db.session.flush()

        self.farmer = User(
            username="khqrpay_farmer",
            email="khqrpay_farmer@example.com",
        )
        self.farmer.set_password("TestPassword123!")
        self.farmer.roles.append(farmer_role)
        db.session.add(self.farmer)
        db.session.commit()

        self.order_tx = PaymentTransaction(
            user_id=self.farmer.id,
            payment_method="KHQRPAY",
            bill_number="INV-2048",
            md5="pay_live_2048",
            amount=16.88,
            currency="USD",
            billing_interval="monthly",
            status="PENDING",
        )
        db.session.add(self.order_tx)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _build_event_bytes(
        self,
        *,
        event_id: str = "evt_live_001",
        event_type: str = "payment.completed",
        payment_id: str = "pay_live_2048",
        status: str = "paid",
        amount: str = "16.88",
        currency: str = "USD",
        requested_amount: str | None = "16.88",
        requested_currency: str | None = "USD",
        conversion_rate: int | None = None,
        reference_id: str = "INV-2048",
        livemode: bool = True,
        is_test: bool = False,
        late: bool | None = None,
        monitoring_gap: bool | None = None,
    ) -> bytes:
        payment_obj = {
            "id": payment_id,
            "status": status,
            "amount": amount,
            "currency": currency,
            "requested_amount": requested_amount,
            "requested_currency": requested_currency,
            "settlement_amount": amount,
            "settlement_currency": currency,
            "conversion_rate": conversion_rate,
            "reference_id": reference_id,
            "metadata": {"cart_id": "cart_7Hq2"},
            "approved_at": "2026-11-20T12:00:00Z" if status == "paid" else None,
        }
        if late is not None:
            payment_obj["late"] = late
        if monitoring_gap is not None:
            payment_obj["monitoring_gap"] = monitoring_gap

        payload = {
            "id": event_id,
            "type": event_type,
            "livemode": livemode,
            "created": int(time.time()),
            "data": {"payment": payment_obj},
        }
        if is_test:
            payload["test"] = True
        return json.dumps(payload, separators=(",", ":")).encode("utf-8")

    def test_webhook_valid_signature_fulfils_order(self):
        """1. Valid signature on live payment.completed returns 200 and fulfils the order."""
        raw_body = self._build_event_bytes(
            event_id="evt_valid_001",
            event_type="payment.completed",
            # Payer paid in KHR on a KHR ABA link while order was priced in USD:
            # webhook must verify against requested_amount and requested_currency (Requirement 6).
            amount="67520",
            currency="KHR",
            requested_amount="16.88",
            requested_currency="USD",
            conversion_rate=4000,
        )
        sig = sign_khqrpay_payload(raw_body)

        resp = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sig,
                "X-KHQRPay-Delivery": "del_001",
            },
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["received"])
        self.assertTrue(body["fulfilled"])
        self.assertFalse(body["duplicate"])

        db.session.refresh(self.order_tx)
        db.session.refresh(self.farmer)
        self.assertEqual(self.order_tx.status, "PAID")
        self.assertIsNotNone(self.order_tx.paid_at)
        self.assertTrue(self.farmer.is_premium)

    def test_webhook_tampered_body_rejected_with_400(self):
        """2. Tampered body fails constant-time HMAC verification and returns 400."""
        original_body = self._build_event_bytes(event_id="evt_tampered_001")
        sig = sign_khqrpay_payload(original_body)
        tampered_body = original_body.replace(b'"16.88"', b'"0.01"')

        resp = self.client.post(
            "/api/webhooks/khqrpay",
            data=tampered_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sig,
            },
        )
        self.assertEqual(resp.status_code, 400)
        db.session.refresh(self.order_tx)
        self.assertEqual(self.order_tx.status, "PENDING")
        self.assertFalse(self.farmer.is_premium)

    def test_webhook_missing_or_malformed_header_or_empty_secret_returns_400(self):
        """3. Missing header, malformed header, or empty signing secret returns 400 without crashing."""
        raw_body = self._build_event_bytes(event_id="evt_missing_hdr_001")

        # Missing X-KHQRPay-Signature header
        resp_missing = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(resp_missing.status_code, 400)

        # Malformed X-KHQRPay-Signature header
        resp_malformed = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Signature": "invalid-signature-header",
            },
        )
        self.assertEqual(resp_malformed.status_code, 400)

        # Unset/empty signing secret must refuse every event (even if signed with an empty key)
        empty_sig = sign_khqrpay_payload(raw_body, secret="")
        with patch.dict(self.app.config, {"KHQRPAY_WEBHOOK_SECRET": ""}), patch.dict(
            os.environ, {"KHQRPAY_WEBHOOK_SECRET": ""}, clear=False
        ):
            resp_empty_secret = self.client.post(
                "/api/webhooks/khqrpay",
                data=raw_body,
                headers={
                    "Content-Type": "application/json",
                    "X-KHQRPay-Signature": empty_sig,
                },
            )
            self.assertEqual(resp_empty_secret.status_code, 400)

        db.session.refresh(self.order_tx)
        self.assertEqual(self.order_tx.status, "PENDING")

    def test_webhook_old_timestamp_rejected_with_400(self):
        """4. Timestamp more than 5 minutes (300s) from current time is rejected with 400."""
        raw_body = self._build_event_bytes(event_id="evt_old_ts_001")
        old_ts = int(time.time()) - 360  # 6 minutes ago
        sig = sign_khqrpay_payload(raw_body, timestamp=old_ts)

        resp = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sig,
            },
        )
        self.assertEqual(resp.status_code, 400)
        db.session.refresh(self.order_tx)
        self.assertEqual(self.order_tx.status, "PENDING")

    def test_webhook_duplicate_event_id_deduplicated(self):
        """5. Duplicate event id returns 200 and fulfils only once (deduplicated on event id, not payment id)."""
        raw_body = self._build_event_bytes(event_id="evt_dup_001")
        sig1 = sign_khqrpay_payload(raw_body)

        resp1 = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sig1,
            },
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertTrue(resp1.get_json()["fulfilled"])
        self.assertFalse(resp1.get_json()["duplicate"])

        db.session.refresh(self.farmer)
        first_expiry = self.farmer.premium_expires_at
        self.assertIsNotNone(first_expiry)

        # Replay the exact same event_id with a fresh signature (as KHQRPay dashboard resend does)
        sig2 = sign_khqrpay_payload(raw_body, timestamp=int(time.time()) + 2)
        resp2 = self.client.post(
            "/api/webhooks/khqrpay",
            data=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sig2,
            },
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.get_json()["duplicate"])
        self.assertFalse(resp2.get_json()["fulfilled"])

        # Premium expiration was not double-extended
        db.session.refresh(self.farmer)
        self.assertEqual(self.farmer.premium_expires_at, first_expiry)
        self.assertEqual(KHQRPayWebhookEvent.query.filter_by(event_id="evt_dup_001").count(), 1)

    def test_webhook_test_event_and_livemode_false_fulfil_nothing(self):
        """6. Test events (livemode=False or test=True) answer 200 and fulfil nothing (Requirement 7)."""
        # Case A: livemode=False
        body_non_live = self._build_event_bytes(
            event_id="evt_test_mode_001",
            livemode=False,
            is_test=False,
        )
        resp_a = self.client.post(
            "/api/webhooks/khqrpay",
            data=body_non_live,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Signature": sign_khqrpay_payload(body_non_live),
            },
        )
        self.assertEqual(resp_a.status_code, 200)
        self.assertFalse(resp_a.get_json()["fulfilled"])

        # Case B: dashboard test event ("test": true)
        body_dashboard_test = self._build_event_bytes(
            event_id="evt_test_mode_002",
            payment_id="pay_test_123",
            reference_id="test_order",
            livemode=True,
            is_test=True,
        )
        resp_b = self.client.post(
            "/api/webhooks/khqrpay",
            data=body_dashboard_test,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Signature": sign_khqrpay_payload(body_dashboard_test),
            },
        )
        self.assertEqual(resp_b.status_code, 200)
        self.assertFalse(resp_b.get_json()["fulfilled"])

        db.session.refresh(self.order_tx)
        db.session.refresh(self.farmer)
        self.assertEqual(self.order_tx.status, "PENDING")
        self.assertFalse(self.farmer.is_premium)

    def test_webhook_late_payment_completed_after_payment_expired_fulfils_order(self):
        """7. Late payment.completed (data.payment.late=true) after payment.expired fulfils the order (Requirements 5, 6, 8)."""
        # Step 1: payment.scanned arrives -> 200, not fulfilled
        scanned_body = self._build_event_bytes(
            event_id="evt_seq_scanned",
            event_type="payment.scanned",
            status="scanned",
        )
        resp_scan = self.client.post(
            "/api/webhooks/khqrpay",
            data=scanned_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.scanned",
                "X-KHQRPay-Signature": sign_khqrpay_payload(scanned_body),
            },
        )
        self.assertEqual(resp_scan.status_code, 200)
        self.assertFalse(resp_scan.get_json()["fulfilled"])

        # Step 2: payment.expired arrives for the same payment_id -> marks order EXPIRED
        expired_body = self._build_event_bytes(
            event_id="evt_seq_expired",
            event_type="payment.expired",
            status="expired",
        )
        resp_exp = self.client.post(
            "/api/webhooks/khqrpay",
            data=expired_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.expired",
                "X-KHQRPay-Signature": sign_khqrpay_payload(expired_body),
            },
        )
        self.assertEqual(resp_exp.status_code, 200)
        self.assertFalse(resp_exp.get_json()["fulfilled"])
        db.session.refresh(self.order_tx)
        self.assertEqual(self.order_tx.status, "EXPIRED")
        self.assertFalse(self.farmer.is_premium)

        # Step 3: Late payment.completed arrives with data.payment.late = True -> transitions EXPIRED -> PAID and fulfils!
        late_completed_body = self._build_event_bytes(
            event_id="evt_seq_late_completed",
            event_type="payment.completed",
            status="paid",
            late=True,
        )
        resp_late = self.client.post(
            "/api/webhooks/khqrpay",
            data=late_completed_body,
            headers={
                "Content-Type": "application/json",
                "X-KHQRPay-Event": "payment.completed",
                "X-KHQRPay-Signature": sign_khqrpay_payload(late_completed_body),
            },
        )
        self.assertEqual(resp_late.status_code, 200)
        late_json = resp_late.get_json()
        self.assertTrue(late_json["fulfilled"])
        self.assertTrue(late_json["late"])

        db.session.refresh(self.order_tx)
        db.session.refresh(self.farmer)
        self.assertEqual(self.order_tx.status, "PAID")
        self.assertTrue(self.farmer.is_premium)
        meta = json.loads(self.order_tx.metadata_json)
        self.assertTrue(meta["late"])

    def test_create_payment_and_read_budget_exhausted_new_key_retry(self):
        """Verify create_khqrpay_payment sends string reference_id, per-attempt Idempotency-Key, and retries with a new key on 429 X-ReadBudget-Remaining: 0."""
        calls: list[dict] = []

        def fake_http(method, path, *, api_key, payload=None, headers=None, base_url=None, timeout=15.0):
            calls.append({"method": method, "path": path, "payload": payload, "headers": dict(headers or {})})
            if len(calls) == 1:
                raise KHQRPayAPIError(
                    "rate_limited",
                    "Daily read budget exhausted for idempotency replay.",
                    status_code=429,
                    retry_after=3600,
                    headers={"X-ReadBudget-Remaining": "0", "Retry-After": "3600"},
                )
            return (
                201,
                {
                    "id": "pay_test_created_2048",
                    "object": "payment",
                    "livemode": False,
                    "status": "pending",
                    "amount": "67520",
                    "currency": "KHR",
                    "requested_amount": "16.88",
                    "requested_currency": "USD",
                    "settlement_amount": "67520",
                    "settlement_currency": "KHR",
                    "conversion_rate": 4000,
                    "reference_id": "2048",
                    "metadata": {"cart_id": "cart_7Hq2", "long_id": "12345678901234567"},
                    "qr_string": "00020101021229...",
                    "checkout_url": "https://khqrpay.dev/checkout/pay_test_created_2048",
                    "approved_at": None,
                    "scanned_at": None,
                    "created_at": "2026-11-20T12:00:00Z",
                    "expires_at": "2026-11-20T12:05:00Z",
                },
                {"X-ReadBudget-Remaining": "0"},
            )

        res = create_khqrpay_payment(
            amount=16.88,
            currency="usd",
            reference_id=2048,  # numeric order id must be converted to string "2048"
            attempt=1,
            metadata={"cart_id": "cart_7Hq2", "long_id": 12345678901234567},
            user=self.farmer,
            http_fn=fake_http,
        )
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0]["payload"]["reference_id"], "2048")
        self.assertEqual(calls[0]["payload"]["amount"], "16.88")
        self.assertEqual(calls[0]["payload"]["metadata"]["long_id"], "12345678901234567")
        self.assertEqual(calls[0]["headers"]["Idempotency-Key"], "2048-attempt-1")
        self.assertNotEqual(calls[1]["headers"]["Idempotency-Key"], "2048-attempt-1")
        self.assertEqual(res["checkout_url"], "https://khqrpay.dev/checkout/pay_test_created_2048")
        self.assertEqual(res["qr_string"], "00020101021229...")
        self.assertEqual(res["expires_at"], "2026-11-20T12:05:00Z")
        self.assertTrue(res["qr_svg_url"].endswith(".svg"))

    def test_check_expired_payment_before_cancel_enforces_1h_grace_and_monitoring_gap(self):
        """Verify 1-hour post-expiry hold and monitoring_gap unknown status check (Requirement 8)."""
        now_dt = datetime(2026, 11, 20, 12, 30, 0, tzinfo=timezone.utc).replace(tzinfo=None)
        recent_expiry = "2026-11-20T12:00:00Z"  # Only 30m ago (< 1 hour)

        grace_res = check_expired_payment_before_cancel(
            "pay_live_2048",
            expires_at=recent_expiry,
            now_dt=now_dt,
        )
        self.assertFalse(grace_res["can_cancel"])
        self.assertEqual(grace_res["resolution"], "grace_period_active")

        # Over 1 hour after expires_at, re-reads GET /v1/payments/:id and checks monitoring_gap
        later_dt = datetime(2026, 11, 20, 13, 5, 0, tzinfo=timezone.utc).replace(tzinfo=None)

        def fake_gap_http(method, path, *, api_key, payload=None, headers=None, base_url=None, timeout=15.0):
            return (
                200,
                {
                    "id": "pay_live_2048",
                    "status": "expired",
                    "expires_at": recent_expiry,
                    "monitoring_gap": True,
                },
                {},
            )

        gap_res = check_expired_payment_before_cancel(
            "pay_live_2048",
            expires_at=recent_expiry,
            now_dt=later_dt,
            http_fn=fake_gap_http,
        )
        self.assertFalse(gap_res["can_cancel"])
        self.assertEqual(gap_res["resolution"], "unknown")
        self.assertTrue(gap_res["monitoring_gap"])

    def test_simulate_test_payment_endpoint(self):
        """Verify POST /v1/test/payments/:id/simulate requires kp_test_ key and valid status (Requirement 11)."""
        captured = {}

        def fake_sim_http(method, path, *, api_key, payload=None, headers=None, base_url=None, timeout=15.0):
            captured["method"] = method
            captured["path"] = path
            captured["payload"] = payload
            return 200, {"id": "pay_test_99", "status": payload["status"]}, {}

        sim_res = simulate_khqrpay_test_payment("pay_test_99", "paid", http_fn=fake_sim_http)
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["path"], "/v1/test/payments/pay_test_99/simulate")
        self.assertEqual(sim_res["status"], "paid")

    def test_bakong_service_delegates_to_khqrpay_when_enabled(self):
        """Verify create_khqr_payment and verify_khqr_payment in bakong_service delegate to KHQRPay."""
        from app.services.bakong_service import create_khqr_payment, verify_khqr_payment

        future_exp = (datetime.now(timezone.utc) + timedelta(minutes=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
        extended_exp = (datetime.now(timezone.utc) + timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%SZ")

        def fake_http(method, path, *, api_key, payload=None, headers=None, base_url=None, timeout=15.0):
            if method == "POST" and path == "/v1/payments":
                return (
                    201,
                    {
                        "id": "pay_test_checkout_01",
                        "object": "payment",
                        "livemode": False,
                        "status": "pending",
                        "amount": "20.00",
                        "currency": "USD",
                        "requested_amount": "20.00",
                        "requested_currency": "USD",
                        "settlement_amount": "20.00",
                        "settlement_currency": "USD",
                        "conversion_rate": None,
                        "reference_id": payload["reference_id"],
                        "metadata": payload.get("metadata"),
                        "qr_string": "00020101021229210017khqrpay_test@test520459995303840540520.005802KH5913AgriSystemPro6010Phnom Penh6304ABCD",
                        "checkout_url": "https://khqrpay.dev/checkout/pay_test_checkout_01",
                        "created_at": "2026-11-20T12:00:00Z",
                        "expires_at": future_exp,
                    },
                    {},
                )
            if method == "GET" and path == "/v1/payments/pay_test_checkout_01":
                return (
                    200,
                    {
                        "id": "pay_test_checkout_01",
                        "object": "payment",
                        "livemode": False,
                        "status": "paid",
                        "amount": "20.00",
                        "currency": "USD",
                        "requested_amount": "20.00",
                        "requested_currency": "USD",
                        "settlement_amount": "20.00",
                        "settlement_currency": "USD",
                        "reference_id": "BILL-TEST",
                        "expires_at": extended_exp,
                        "approved_at": "2026-11-20T12:01:00Z",
                    },
                    {},
                )
            raise AssertionError(f"Unexpected call: {method} {path}")

        with patch.dict(self.app.config, {"KHQRPAY_ENABLED_IN_TESTS": True}), patch(
            "app.services.khqrpay_service._execute_khqrpay_http",
            side_effect=fake_http,
        ):
            created = create_khqr_payment(user=self.farmer, amount=20.0, billing_interval="monthly")
            self.assertTrue(created["success"])
            self.assertEqual(created["provider"], "khqrpay")
            self.assertEqual(created["md5"], "pay_test_checkout_01")
            self.assertEqual(created["deeplink"], "https://khqrpay.dev/checkout/pay_test_checkout_01")
            self.assertGreater(created["remaining_seconds"], 120)

            verified = verify_khqr_payment("pay_test_checkout_01", bypass_cache=True)
            self.assertTrue(verified["success"])
            self.assertEqual(verified["status"], "PAID")
            db.session.refresh(self.farmer)
            self.assertTrue(self.farmer.is_premium)


if __name__ == "__main__":
    unittest.main()
