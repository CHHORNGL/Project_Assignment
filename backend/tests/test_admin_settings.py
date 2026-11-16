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
import unittest
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.role import Role
from app.models.site_setting import SiteSetting
from app.blueprints.farmer.support_chat import resolve_real_location
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


class AdminSettingsTestCase(unittest.TestCase):
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
        self.client = self.app.test_client()
        db.create_all()

        admin_role = Role(name="admin", route_type="admin")
        db.session.add(admin_role)

        self.admin = User(
            username="testadmin",
            email="admin@agrisystem.local",
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

    def login_admin(self):
        import time
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.admin.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.admin)

    def test_settings_requires_admin_login(self):
        resp = self.client.get("/admin/settings")
        self.assertIn(resp.status_code, (302, 401, 403))

    def test_settings_page_renders_clean_professional_ui(self):
        self.login_admin()
        resp = self.client.get("/admin/settings")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # Standard Admin Board & Navigation Tabs
        self.assertIn("admin-board", html)
        self.assertIn("settings-nav", html)
        self.assertIn("tab-general", html)
        self.assertNotIn("tab-llm", html)
        self.assertIn("tab-trained", html)
        self.assertIn("tab-guide", html)

        # General System & Location Settings
        self.assertIn("cambodia_province_select", html)
        self.assertIn("server_location_name", html)
        self.assertIn("server_location_lat", html)
        self.assertIn("server_location_lon", html)
        self.assertIn("link-gmaps-preview", html)

        # Only the owner's self-trained model controls are exposed.
        self.assertNotIn("provider_groq", html)
        self.assertNotIn("provider_openai", html)
        self.assertNotIn("provider_gemini", html)
        self.assertIn("test-trained-ai", html)

        # Ark Expert AI Controls
        self.assertIn("generate-model-key", html)
        self.assertIn("test-trained-ai", html)

    def test_save_general_and_server_location_settings(self):
        self.login_admin()
        post_data = {
            "form_type": "general",
            "system_name": "Battambang Agri Research",
            "server_location_name": "Battambang, Cambodia",
            "server_location_lat": "13.0957",
            "server_location_lon": "103.2022",
        }
        resp = self.client.post("/admin/settings", data=post_data, follow_redirects=True)
        self.assertEqual(resp.status_code, 200)

        # Verify values stored in DB
        sys_name = SiteSetting.query.get("SYSTEM_NAME")
        srv_name = SiteSetting.query.get("SERVER_LOCATION_NAME")
        srv_lat = SiteSetting.query.get("SERVER_LOCATION_LAT")
        srv_lon = SiteSetting.query.get("SERVER_LOCATION_LON")

        self.assertIsNotNone(sys_name)
        self.assertEqual(sys_name.value, "Battambang Agri Research")
        self.assertEqual(srv_name.value, "Battambang, Cambodia")
        self.assertEqual(srv_lat.value, "13.0957")
        self.assertEqual(srv_lon.value, "103.2022")

        # Verify resolve_real_location uses the configured server location
        loc_info = resolve_real_location()
        self.assertTrue(loc_info["success"])
        self.assertAlmostEqual(loc_info["latitude"], 13.0957, places=3)
        self.assertAlmostEqual(loc_info["longitude"], 103.2022, places=3)
        self.assertEqual(loc_info["display_name"], "Battambang, Cambodia")
        self.assertIn("13.0957", loc_info["maps_url"])

    def test_sidebar_live_support_is_simple_and_not_in_controller(self):
        self.login_admin()
        resp = self.client.get("/admin/settings")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # Check Live Support is present as top-level simple nav-item
        self.assertIn('href="/admin/support_chats"', html)
        self.assertIn('class="nav-label">Live Support</span>', html)

        # Extract collapseController block and verify Live Support is NOT inside it
        controller_start = html.find('id="collapseController"')
        self.assertNotEqual(controller_start, -1)
        controller_end = html.find('</div>', controller_start)
        controller_inner_end = html.find('</div>', controller_end + 6)
        controller_block = html[controller_start:controller_inner_end + 6]

        self.assertNotIn('/admin/support_chats', controller_block)
        self.assertIn('/admin/premium-settings', controller_block)
        self.assertIn('/admin/marquees', controller_block)
        self.assertIn('/admin/support-requests', controller_block)
        self.assertIn('/admin/promo-codes', controller_block)

    def test_provinces_bootstrap_and_invalid_coords_rejected(self):
        self.login_admin()
        resp = self.client.get("/admin/settings")
        self.assertEqual(resp.status_code, 200)
        bootstrap = _extract_bootstrap_payload(resp.get_data(as_text=True))
        provinces = bootstrap["data"]["provinces"]

        self.assertEqual(len(provinces), 25)
        names = {p["name"] for p in provinces}
        self.assertIn("Phnom Penh, Cambodia", names)
        self.assertIn("Battambang, Cambodia", names)

        # Save valid baseline coordinates first
        self.client.post(
            "/admin/settings",
            data={
                "form_type": "general",
                "system_name": "AgriSystem",
                "server_location_name": "Siem Reap, Cambodia",
                "server_location_lat": "13.3671",
                "server_location_lon": "103.8448",
            },
        )

        # Attempt invalid latitude -> should be rejected without overwriting
        bad_resp = self.client.post(
            "/admin/settings",
            data={
                "form_type": "general",
                "system_name": "Should Not Save",
                "server_location_name": "Nowhere",
                "server_location_lat": "250.0",
                "server_location_lon": "103.8448",
            },
            follow_redirects=True,
        )
        self.assertEqual(bad_resp.status_code, 200)
        self.assertEqual(SiteSetting.query.get("SERVER_LOCATION_LAT").value, "13.3671")
        self.assertEqual(SiteSetting.query.get("SYSTEM_NAME").value, "AgriSystem")

    def test_trained_model_profile_switch_edit_and_delete(self):
        self.login_admin()

        # Register first profile & activate
        resp1 = self.client.post(
            "/admin/settings",
            data={
                "model_action": "activate",
                "label": "Primary Qwen",
                "model_id": "Maoseavik/agri-qwen3b",
                "endpoint": "https://primary.hf.space",
                "model_api_key": "secret-token-1",
            },
            follow_redirects=True,
        )
        self.assertEqual(resp1.status_code, 200)

        # Register second profile on standby
        resp2 = self.client.post(
            "/admin/settings",
            data={
                "model_action": "save",
                "label": "Canary Qwen",
                "model_id": "Maoseavik/agri-qwen-canary",
                "endpoint": "https://canary.hf.space",
                "model_api_key": "secret-token-2",
            },
            follow_redirects=True,
        )
        self.assertEqual(resp2.status_code, 200)

        bootstrap = _extract_bootstrap_payload(resp2.get_data(as_text=True))
        models = bootstrap["data"]["trainedAi"]["hfModels"]
        self.assertEqual(len(models), 2)
        canary = next(m for m in models if m["label"] == "Canary Qwen")
        primary = next(m for m in models if m["label"] == "Primary Qwen")
        self.assertTrue(primary["active"])
        self.assertTrue(primary["hasToken"])

        # Switch active profile to Canary via model_action=switch
        resp_switch = self.client.post(
            "/admin/settings",
            data={"model_action": "switch", "profile_id": canary["id"]},
            follow_redirects=True,
        )
        self.assertEqual(resp_switch.status_code, 200)
        self.assertEqual(SiteSetting.query.get("HF_ACTIVE_MODEL").value, canary["id"])
        self.assertEqual(SiteSetting.query.get("HF_INFERENCE_URL").value, "https://canary.hf.space")

        # Update primary engine endpoint while active profile matches -> stays synced on reload
        resp_primary = self.client.post(
            "/admin/settings",
            data={
                "hf_model_id": "Maoseavik/agri-qwen-canary-v2",
                "hf_inference_url": "https://canary-v2.hf.space",
                "hf_api_key": "",
            },
            follow_redirects=True,
        )
        self.assertEqual(resp_primary.status_code, 200)
        after_primary = _extract_bootstrap_payload(resp_primary.get_data(as_text=True))
        self.assertEqual(after_primary["data"]["trainedAi"]["hfInferenceUrl"], "https://canary-v2.hf.space")

        # Delete active profile -> falls back cleanly to remaining profile
        resp_delete = self.client.post(
            "/admin/settings",
            data={"model_action": "delete", "profile_id": canary["id"]},
            follow_redirects=True,
        )
        self.assertEqual(resp_delete.status_code, 200)
        self.assertEqual(SiteSetting.query.get("HF_ACTIVE_MODEL").value, primary["id"])

        actions = {log.action for log in AuditLog.query.all()}
        self.assertIn("SAVE_AI_MODEL", actions)
        self.assertIn("SWITCH_AI_MODEL", actions)
        self.assertIn("UPDATE_AI_SETTINGS", actions)
        self.assertIn("DELETE_AI_MODEL", actions)


if __name__ == "__main__":
    unittest.main()
