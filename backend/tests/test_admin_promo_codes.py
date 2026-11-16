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
from datetime import datetime
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.permission import Permission
from app.models.promo import PromoCode
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


class AdminPromoCodesTestCase(unittest.TestCase):
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

        perm = Permission(code="manage_users", name="Manage Users")
        admin_role = Role(name="admin", route_type="admin")
        admin_role.permissions.append(perm)
        db.session.add_all([perm, admin_role])

        self.admin = User(
            username="promo_admin",
            email="promo-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)

        self.claimer = User(
            username="lucky_farmer",
            email="lucky@agrisystem.local",
            is_active=True,
        )
        self.claimer.set_password("FarmerPass123!")
        db.session.add_all([self.admin, self.claimer])
        db.session.commit()

        db.session.add(
            PromoCode(
                code="USED2026",
                tokens_reward=5000,
                is_used=True,
                used_by_id=self.claimer.id,
                used_at=datetime(2026, 8, 28, 3, 34, 24),
            )
        )
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

    def test_promo_codes_bootstrap_reads_is_used_and_claimer_correctly(self):
        self._login_admin()
        resp = self.client.get("/admin/promo-codes")
        self.assertEqual(resp.status_code, 200)
        data = _extract_bootstrap_payload(resp.get_data(as_text=True))["data"]
        self.assertEqual(data["bulkActionUrl"], "/admin/promo-codes/bulk")
        self.assertEqual(data["links"]["premiumSettingsUrl"], "/admin/premium-settings")
        row = data["codes"][0]
        self.assertEqual(row["code"], "USED2026")
        self.assertTrue(row["isRedeemed"])
        self.assertEqual(row["redeemedBy"], "lucky_farmer")
        self.assertIsNotNone(row["redeemedAt"])

    def test_custom_batch_mint_and_clear_redeemed_bulk(self):
        self._login_admin()
        custom_resp = self.client.post(
            "/admin/promo-codes",
            data={"tokens": "2500", "quantity": "1", "custom_code": "harvest99"},
            follow_redirects=False,
        )
        self.assertEqual(custom_resp.status_code, 302)
        self.assertIsNotNone(PromoCode.query.filter_by(code="HARVEST99", tokens_reward=2500).first())

        batch_resp = self.client.post(
            "/admin/promo-codes",
            data={"tokens": "1000", "quantity": "3"},
            follow_redirects=False,
        )
        self.assertEqual(batch_resp.status_code, 302)
        self.assertEqual(PromoCode.query.count(), 5)

        clear_resp = self.client.post(
            "/admin/promo-codes/bulk",
            data={"action": "clear_redeemed"},
            follow_redirects=False,
        )
        self.assertEqual(clear_resp.status_code, 302)
        self.assertEqual(PromoCode.query.filter_by(is_used=True).count(), 0)
        self.assertEqual(PromoCode.query.count(), 4)


if __name__ == "__main__":
    unittest.main()
