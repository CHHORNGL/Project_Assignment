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
from app.models.marquee import Marquee
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


class AdminMarqueesTestCase(unittest.TestCase):
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
            username="marquee_admin",
            email="marquee-admin@agrisystem.local",
            is_active=True,
        )
        self.admin.set_password("AdminPass123!")
        self.admin.roles.append(admin_role)
        db.session.add(self.admin)
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

    def test_marquee_lifecycle_add_toggle_edit_and_delete(self):
        self._login_admin()

        add_resp = self.client.post(
            "/admin/marquees/add",
            data={
                "text": "  Spring advisory update  ",
                "text_kh": "  សេចក្តីជូនដំណឹងរដូវប្រាំង  ",
                "sort_order": "5",
                "is_active": "on",
            },
            follow_redirects=False,
        )
        self.assertEqual(add_resp.status_code, 302)
        m = Marquee.query.first()
        self.assertIsNotNone(m)
        self.assertEqual(m.text, "Spring advisory update")
        self.assertEqual(m.sort_order, 5)
        self.assertTrue(m.is_active)

        list_resp = self.client.get("/admin/marquees")
        self.assertEqual(list_resp.status_code, 200)
        data = _extract_bootstrap_payload(list_resp.get_data(as_text=True))["data"]
        self.assertEqual(data["marquees"][0]["toggleAction"], f"/admin/marquees/toggle/{m.id}")

        toggle_resp = self.client.post(
            f"/admin/marquees/toggle/{m.id}",
            follow_redirects=False,
        )
        self.assertEqual(toggle_resp.status_code, 302)
        db.session.refresh(m)
        self.assertFalse(m.is_active)

        form_resp = self.client.get(f"/admin/marquees/edit/{m.id}")
        self.assertEqual(form_resp.status_code, 200)
        form_data = _extract_bootstrap_payload(form_resp.get_data(as_text=True))["data"]
        self.assertEqual(form_data["marqueeId"], m.id)
        self.assertEqual(form_data["aiTranslateUrl"], "/admin/translations/ai")

        del_resp = self.client.post(
            f"/admin/marquees/delete/{m.id}",
            follow_redirects=False,
        )
        self.assertEqual(del_resp.status_code, 302)
        self.assertEqual(Marquee.query.count(), 0)


if __name__ == "__main__":
    unittest.main()
