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
from datetime import datetime, timedelta
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.permission import Permission
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


class AdminAuditLogsTestCase(unittest.TestCase):
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

        perm_dash = Permission(code="view_dashboard", name="View Admin Dashboard")
        admin_role = Role(name="admin", route_type="admin")
        admin_role.permissions.append(perm_dash)
        db.session.add_all([perm_dash, admin_role])

        self.admin_user = User(
            username="audit_admin",
            email="audit-admin@agrisystem.local",
            is_active=True,
        )
        self.admin_user.set_password("AdminPass123!")
        self.admin_user.roles.append(admin_role)
        db.session.add(self.admin_user)
        db.session.commit()

        now = datetime.utcnow()
        db.session.add_all([
            AuditLog(
                user_id=self.admin_user.id,
                action="AUTH_LOGIN_SUCCESS",
                target_user="audit_admin",
                detail="ip=127.0.0.1 Browser signed in",
                created_at=now - timedelta(hours=1),
            ),
            AuditLog(
                user_id=None,
                action="STAFF_LOGIN_FAILURE",
                target_user="=badformula@test.local",
                detail="ip=10.0.0.5 status=FAILURE Invalid staff credentials",
                created_at=now - timedelta(hours=2),
            ),
            AuditLog(
                user_id=self.admin_user.id,
                action="UPDATE_ROLE_PERMISSIONS",
                target_user="expert",
                detail="Updated policy bundle",
                created_at=now - timedelta(days=3),
            ),
        ])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login_admin(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.admin_user.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.admin_user)

    def test_audit_logs_bootstrap_stats_and_filtering(self):
        self._login_admin()
        resp = self.client.get("/admin/audit-logs")
        self.assertEqual(resp.status_code, 200)
        payload = _extract_bootstrap_payload(resp.get_data(as_text=True))
        self.assertEqual(payload["page"]["id"], "admin-audit-logs")
        data = payload["data"]
        self.assertEqual(data["stats"]["totalCount"], 3)
        self.assertEqual(data["stats"]["last24hCount"], 2)
        self.assertEqual(data["stats"]["failureCount"], 1)
        self.assertEqual(data["stats"]["uniqueActors"], 1)
        self.assertEqual(len(data["logs"]), 3)

        filtered = self.client.get("/admin/audit-logs?action=STAFF_LOGIN_FAILURE")
        self.assertEqual(filtered.status_code, 200)
        f_data = _extract_bootstrap_payload(filtered.get_data(as_text=True))["data"]
        self.assertEqual(len(f_data["logs"]), 1)
        self.assertEqual(f_data["logs"][0]["actorName"], "System")

    def test_audit_logs_export_csv_and_json_neutralizes_formula_injection(self):
        self._login_admin()
        csv_resp = self.client.get("/admin/audit-logs/export?format=csv&action=STAFF_LOGIN_FAILURE")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn("text/csv", csv_resp.content_type)
        body = csv_resp.get_data(as_text=True)
        self.assertIn("'=badformula@test.local", body)

        json_resp = self.client.get("/admin/audit-logs/export?format=json")
        self.assertEqual(json_resp.status_code, 200)
        parsed = json.loads(json_resp.get_data(as_text=True))
        self.assertIn("logs", parsed)
        self.assertGreaterEqual(len(parsed["logs"]), 3)


if __name__ == "__main__":
    unittest.main()
