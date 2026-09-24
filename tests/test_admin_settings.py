import os
import tempfile
import unittest

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from app.models.site_setting import SiteSetting
from app.blueprints.farmer.support_chat import resolve_real_location
from app.utils.session_security import credential_stamp


class AdminSettingsTestCase(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
