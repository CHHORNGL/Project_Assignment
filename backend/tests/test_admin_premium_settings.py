# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import json
import os
import re
import tempfile
import time
import unittest
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.payment_transaction import PaymentTransaction
from app.models.premium_coupon import PremiumCoupon
from app.models.role import Role
from app.models.user import User
from app.utils.session_security import credential_stamp


def _extract_bootstrap_payload(html: str) -> dict:
    match = re.search(
        r'<script[^>]*id=["\']app-bootstrap["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not match:
        raise AssertionError("Expected #app-bootstrap script tag in rendered HTML")
    return json.loads(match.group(1))


class AdminPremiumSettingsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update({"TESTING": True, "WTF_CSRF_ENABLED": False})

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
        self.client = self.app.test_client()
        db.create_all()

        admin_role = Role(name="admin", route_type="admin")
        db.session.add(admin_role)
        self.admin = User(
            username="billing_admin",
            email="billing-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)

        self.farmer = User(
            username="vip_farmer",
            email="vip@agrisystem.local",
            is_active=True,
            is_premium=True,
        )
        self.farmer.set_password("FarmerPass123!")
        db.session.add_all([self.admin, self.farmer])
        db.session.commit()

        db.session.add_all([
            PaymentTransaction(
                user_id=self.farmer.id,
                bill_number="BILL-1001",
                md5="abc123def456",
                amount=20.0,
                currency="USD",
                billing_interval="monthly",
                status="PAID",
                coupon_code="HARVEST20",
            ),
            PaymentTransaction(
                user_id=self.farmer.id,
                bill_number="BILL-1002",
                md5="fff999000111",
                amount=192.0,
                currency="USD",
                billing_interval="yearly",
                status="PENDING",
            ),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login_admin(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.admin.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.admin)

    def test_premium_settings_bootstrap_exposes_tx_stats_links_and_details(self):
        self._login_admin()
        resp = self.client.get("/admin/premium-settings")
        self.assertEqual(resp.status_code, 200)
        data = _extract_bootstrap_payload(resp.get_data(as_text=True))["data"]
        self.assertEqual(data["links"]["promoCodesUrl"], "/admin/promo-codes")
        self.assertEqual(data["pricing"]["premiumCount"], 1)
        self.assertEqual(data["txStats"]["paidCount"], 1)
        self.assertEqual(data["txStats"]["pendingCount"], 1)
        self.assertEqual(data["txStats"]["totalRevenueUsd"], 20.0)
        bills = {tx["billNumber"]: tx for tx in data["transactions"]}
        self.assertEqual(bills["BILL-1001"]["username"], "vip_farmer")
        self.assertEqual(bills["BILL-1001"]["couponCode"], "HARVEST20")

    def test_create_coupon_with_expiry_and_invalid_numeric_guard(self):
        self._login_admin()
        bad_resp = self.client.post(
            "/admin/premium-settings",
            data={"action": "create_coupon", "code": "BAD", "discount_value": "not-a-num"},
            follow_redirects=False,
        )
        self.assertEqual(bad_resp.status_code, 302)
        self.assertEqual(PremiumCoupon.query.count(), 0)

        good_resp = self.client.post(
            "/admin/premium-settings",
            data={
                "action": "create_coupon",
                "code": "spring25",
                "discount_type": "percent",
                "discount_value": "25",
                "max_uses": "50",
                "expires_at": "2026-12-31",
            },
            follow_redirects=False,
        )
        self.assertEqual(good_resp.status_code, 302)
        cp = PremiumCoupon.query.filter_by(code="SPRING25").first()
        self.assertIsNotNone(cp)
        self.assertEqual(cp.discount_value, 25.0)
        self.assertEqual(cp.max_uses, 50)
        self.assertIsNotNone(cp.expires_at)


if __name__ == "__main__":
    unittest.main()
