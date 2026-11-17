import os
import pathlib as _pathlib
import sys as _sys
import tempfile
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
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.payment_transaction import PaymentTransaction
from app.models.role import Role
from app.models.user import User
from app.services.bakong_service import (
    approve_khqr_transaction_manually,
    create_khqr_payment,
    get_bakong_config,
    reconcile_recent_user_khqr_payments,
    verify_khqr_payment,
)


class TestBakongPayment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update({
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
        })

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

        self._deeplink_patcher = patch(
            "bakong_khqr.KHQR.generate_deeplink",
            return_value="https://bakong.page.link/test",
        )
        self._deeplink_patcher.start()

        farmer_role = Role.query.filter_by(name="farmer").first()
        if not farmer_role:
            farmer_role = Role(name="farmer", route_type="farmer")
            db.session.add(farmer_role)
            db.session.flush()

        self.farmer = User(
            username="test_bakong_farmer",
            email="test_bakong@example.com",
        )
        self.farmer.set_password("TestPassword123!")
        self.farmer.roles.append(farmer_role)
        db.session.add(self.farmer)
        db.session.commit()

    def tearDown(self):
        self._deeplink_patcher.stop()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_get_bakong_config(self):
        cfg = get_bakong_config()
        self.assertIn("token", cfg)
        self.assertIn("account_id", cfg)
        self.assertEqual(cfg["account_id"], "seavik_mao@bkrt")
        self.assertEqual(cfg["merchant_name"], "Seavik Mao")

    def test_create_khqr_payment(self):
        result = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        self.assertTrue(result.get("success"), result.get("message"))
        self.assertIn("md5", result)
        self.assertIn("qr_string", result)
        self.assertEqual(result["amount"], 20.0)
        self.assertEqual(result["billing_interval"], "monthly")
        self.assertEqual(result["expires_in_seconds"], 180)
        self.assertGreater(result["remaining_seconds"], 170)
        self.assertIn("expires_at", result)

        # Verify record in database
        tx = PaymentTransaction.query.filter_by(md5=result["md5"]).first()
        self.assertIsNotNone(tx)
        assert tx is not None
        self.assertEqual(tx.status, "PENDING")
        self.assertEqual(tx.user_id, self.farmer.id)

    def test_verify_khqr_payment_success(self):
        # Create a pending payment
        created = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        md5 = created["md5"]

        with patch(
            "app.services.bakong_service.query_bakong_md5_api",
            return_value=("PAID", {}, ""),
        ):
            res = verify_khqr_payment(md5)

        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "PAID")

        # Verify transaction status changed to PAID
        tx = PaymentTransaction.query.filter_by(md5=md5).first()
        self.assertIsNotNone(tx)
        assert tx is not None
        self.assertEqual(tx.status, "PAID")
        self.assertIsNotNone(tx.paid_at)

        # Verify user VIP status updated
        farmer = db.session.get(User, self.farmer.id)
        self.assertIsNotNone(farmer)
        assert farmer is not None
        self.farmer = farmer
        self.assertTrue(self.farmer.is_premium)
        self.assertIsNotNone(self.farmer.premium_expires_at)

    def test_verify_khqr_payment_rate_limited(self):
        created = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        md5 = created["md5"]

        with patch(
            "app.services.bakong_service.query_bakong_md5_api",
            return_value=("RATE_LIMITED", {}, "Daily request limit of 100 exceeded."),
        ):
            res = verify_khqr_payment(md5)

        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "RATE_LIMITED")
        self.assertIn("100 requests", res["message"])

    def test_approve_khqr_transaction_manually(self):
        created = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        tx_id = created["transaction_id"]

        res = approve_khqr_transaction_manually(tx_id)
        self.assertTrue(res["success"])

        tx = db.session.get(PaymentTransaction, tx_id)
        self.assertIsNotNone(tx)
        assert tx is not None
        self.assertEqual(tx.status, "PAID")
        self.assertIsNotNone(tx.paid_at)

        farmer = db.session.get(User, self.farmer.id)
        self.assertIsNotNone(farmer)
        assert farmer is not None
        self.farmer = farmer
        self.assertTrue(self.farmer.is_premium)

    def test_verify_khqr_payment_expires_after_3_minutes_for_farmer_but_allows_admin_check(self):
        created = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        md5 = created["md5"]
        tx = PaymentTransaction.query.filter_by(md5=md5).first()
        assert tx is not None
        tx.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=185)
        db.session.commit()

        res = verify_khqr_payment(md5)
        self.assertFalse(res["success"])
        self.assertEqual(res["status"], "EXPIRED")
        self.assertEqual(res["remaining_seconds"], 0)
        db.session.refresh(tx)
        self.assertEqual(tx.status, "EXPIRED")

        # Admin recovery check can still inspect Bakong directly even after 3-minute checkout timeout.
        with patch(
            "app.services.bakong_service.query_bakong_md5_api",
            return_value=("PAID", {}, ""),
        ):
            admin_res = verify_khqr_payment(md5, enforce_expiry=False, bypass_cache=True)
        self.assertTrue(admin_res["success"])
        self.assertEqual(admin_res["status"], "PAID")

    def test_reuse_pending_khqr_on_mobile_checkout_reload(self):
        first = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
            reuse_pending=True,
        )
        second = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
            reuse_pending=True,
        )
        self.assertEqual(first["md5"], second["md5"])
        self.assertEqual(first["bill_number"], second["bill_number"])
        self.assertEqual(first["transaction_id"], second["transaction_id"])

    def test_return_from_bank_app_reconciles_paid_qr_instead_of_generating_new_qr(self):
        created = create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        md5 = created["md5"]
        tx = PaymentTransaction.query.filter_by(md5=md5).first()
        assert tx is not None
        # Simulate user taking > 3 minutes inside the mobile banking app before returning
        tx.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=210)
        db.session.commit()

        with patch(
            "app.services.bakong_service.query_bakong_md5_api",
            return_value=("PAID", {}, ""),
        ):
            # Force check on return from bank app honours PAID even after 3-minute timer elapsed
            forced_res = verify_khqr_payment(md5, enforce_expiry=True, bypass_cache=True)
            self.assertTrue(forced_res["success"])
            self.assertEqual(forced_res["status"], "PAID")

        farmer = db.session.get(User, self.farmer.id)
        assert farmer is not None
        self.assertTrue(farmer.is_premium)

    def test_reconcile_recent_user_khqr_payments_detects_paid_transaction(self):
        create_khqr_payment(
            user=self.farmer,
            amount=20.0,
            billing_interval="monthly",
        )
        with patch(
            "app.services.bakong_service.query_bakong_md5_api",
            return_value=("PAID", {}, ""),
        ):
            reconciled = reconcile_recent_user_khqr_payments(self.farmer)
        self.assertIsNotNone(reconciled)
        assert reconciled is not None
        self.assertEqual(reconciled["status"], "PAID")
        farmer = db.session.get(User, self.farmer.id)
        assert farmer is not None
        self.assertTrue(farmer.is_premium)


if __name__ == "__main__":
    unittest.main()

