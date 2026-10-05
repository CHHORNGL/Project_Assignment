import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"

from app import create_app
from app.extensions import db
from app.models.payment_transaction import PaymentTransaction
from app.models.role import Role
from app.models.user import User
from app.services.bakong_service import (
    create_khqr_payment,
    get_bakong_config,
    verify_khqr_payment,
)


class TestBakongPayment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
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

        farmer_role = Role.query.filter_by(name="farmer").first()
        if not farmer_role:
            farmer_role = Role(name="farmer", route_type="farmer")
            db.session.add(farmer_role)
            db.session.flush()

        self.farmer = User(username="test_bakong_farmer", email="test_bakong@example.com")
        self.farmer.set_password("TestPassword123!")
        self.farmer.roles.append(farmer_role)
        db.session.add(self.farmer)
        db.session.commit()

    def tearDown(self):
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

        # Verify record in database
        tx = PaymentTransaction.query.filter_by(md5=result["md5"]).first()
        self.assertIsNotNone(tx)
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

        # Mock check_payment response to return 'PAID'
        mock_client = MagicMock()
        mock_client.check_payment.return_value = "PAID"

        with patch("app.services.bakong_service.get_khqr_client", return_value=mock_client):
            res = verify_khqr_payment(md5)

        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "PAID")

        # Verify transaction status changed to PAID
        tx = PaymentTransaction.query.filter_by(md5=md5).first()
        self.assertEqual(tx.status, "PAID")
        self.assertIsNotNone(tx.paid_at)

        # Verify user VIP status updated
        self.farmer = db.session.get(User, self.farmer.id)
        self.assertTrue(self.farmer.is_premium)
        self.assertIsNotNone(self.farmer.premium_expires_at)


if __name__ == "__main__":
    unittest.main()
