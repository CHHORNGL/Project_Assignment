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


class AdminRolesTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update(
            {
                "TESTING": True,
                "WTF_CSRF_ENABLED": False,
            }
        )

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

        self.perm_dash = Permission(code="view_dashboard", name="View Admin Dashboard")
        self.perm_roles = Permission(code="manage_roles", name="Manage Roles & Access")
        self.perm_users = Permission(code="manage_users", name="Manage Member Directory")
        self.perm_diagnose = Permission(code="create_diagnosis", name="Run Crop Diagnosis")
        db.session.add_all([self.perm_dash, self.perm_roles, self.perm_users, self.perm_diagnose])

        self.admin_role = Role(name="admin", route_type="admin")
        self.admin_role.permissions.extend([self.perm_dash, self.perm_roles, self.perm_users])
        self.farmer_role = Role(name="farmer", route_type="farmer")
        self.farmer_role.permissions.append(self.perm_diagnose)
        db.session.add_all([self.admin_role, self.farmer_role])

        self.admin_user = User(
            username="roles_admin",
            email="roles-admin@agrisystem.local",
            is_active=True,
        )
        self.admin_user.set_password("AdminPass123!")
        self.admin_user.roles.append(self.admin_role)
        db.session.add(self.admin_user)
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

    def test_roles_bootstrap_contains_permission_totals_and_preview(self):
        self._login_admin()
        resp = self.client.get("/admin/roles")
        self.assertEqual(resp.status_code, 200)
        payload = _extract_bootstrap_payload(resp.get_data(as_text=True))
        self.assertEqual(payload["page"]["id"], "admin-roles")
        data = payload["data"]
        self.assertEqual(data["totalPermissions"], 4)
        self.assertEqual(data["usersUrl"], "/admin/users")
        by_name = {row["name"]: row for row in data["roles"]}
        self.assertEqual(by_name["admin"]["userCount"], 1)
        self.assertEqual(by_name["admin"]["permissionsCount"], 3)
        self.assertTrue(by_name["admin"]["isCore"])
        self.assertEqual(
            by_name["admin"]["permissionsPreview"],
            ["manage_roles", "manage_users", "view_dashboard"],
        )
        self.assertEqual(by_name["farmer"]["permissionsPreview"], ["create_diagnosis"])

    def test_role_permissions_bootstrap_exposes_permission_names_and_locked_admin_codes(self):
        self._login_admin()
        resp = self.client.get(f"/admin/roles/{self.admin_role.id}/permissions")
        self.assertEqual(resp.status_code, 200)
        payload = _extract_bootstrap_payload(resp.get_data(as_text=True))
        self.assertEqual(payload["page"]["id"], "admin-role-permissions")
        data = payload["data"]
        self.assertEqual(data["totalPermissions"], 4)
        self.assertEqual(
            data["lockedCodes"],
            ["view_dashboard", "manage_users", "manage_roles"],
        )
        self.assertEqual(data["role"]["userCount"], 1)
        self.assertTrue(data["role"]["isCore"])
        self.assertEqual(
            [r["name"] for r in data["siblingRoles"]],
            ["admin", "farmer"],
        )
        self.assertEqual(data["usersUrl"], "/admin/users")
        descriptions = {
            perm["code"]: perm["description"]
            for grp in data["groups"]
            for perm in grp["permissions"]
        }
        self.assertEqual(descriptions["view_dashboard"], "View Admin Dashboard")
        self.assertEqual(descriptions["create_diagnosis"], "Run Crop Diagnosis")

    def test_create_and_delete_custom_role_flow(self):
        self._login_admin()
        create_resp = self.client.post(
            "/admin/roles/create",
            data={"role_name": "Field Agronomist!", "route_type": "farmer"},
            follow_redirects=False,
        )
        self.assertEqual(create_resp.status_code, 302)
        custom = Role.query.filter_by(name="field_agronomist").first()
        self.assertIsNotNone(custom)
        self.assertEqual(custom.route_type, "farmer")
        self.assertEqual([p.code for p in custom.permissions], ["create_diagnosis"])

        delete_resp = self.client.post(
            f"/admin/roles/{custom.id}/delete",
            follow_redirects=False,
        )
        self.assertEqual(delete_resp.status_code, 302)
        self.assertIsNone(Role.query.filter_by(name="field_agronomist").first())


if __name__ == "__main__":
    unittest.main()
