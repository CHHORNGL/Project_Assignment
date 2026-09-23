import os
import tempfile
import time
import unittest

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from app.models.admin_chat import AdminChatMessage
from app.utils.session_security import credential_stamp


class FarmerSupportLocationTestCase(unittest.TestCase):
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

        farmer_role = Role(name="farmer", route_type="farmer")
        admin_role = Role(name="admin", route_type="admin")
        db.session.add_all([farmer_role, admin_role])

        self.farmer = User(username="loc_farmer", email="loc_farmer@example.com")
        self.farmer.set_password("secret123")
        self.farmer.roles.append(farmer_role)

        self.admin = User(username="loc_admin", email="loc_admin@example.com")
        self.admin.set_password("admin123")
        self.admin.roles.append(admin_role)

        db.session.add_all([self.farmer, self.admin])
        db.session.commit()

        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login_farmer(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.farmer.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.farmer)

    def test_anonymous_cannot_access_location_endpoint(self):
        res = self.client.get("/farmer/support_chat/location")
        self.assertEqual(res.status_code, 302)

    def test_farmer_location_default_resolution(self):
        self._login_farmer()
        res = self.client.get("/farmer/support_chat/location")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("Phnom Penh", data.get("display_name"))
        self.assertAlmostEqual(data.get("latitude"), 11.5564, places=2)
        self.assertAlmostEqual(data.get("longitude"), 104.9282, places=2)

    def test_farmer_location_coordinates_resolution(self):
        self._login_farmer()
        # Siem Reap coordinates
        res = self.client.get("/farmer/support_chat/location?lat=13.3671&lon=103.8448")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        name = data.get("display_name", "")
        self.assertTrue("Siem Reap" in name or "សៀមរាប" in name, f"Unexpected name: {name}")
        self.assertAlmostEqual(data.get("latitude"), 13.3671, places=3)
        self.assertAlmostEqual(data.get("longitude"), 103.8448, places=3)

    def test_send_support_location_populates_place_name_if_empty(self):
        self._login_farmer()
        payload = {
            "message": "",
            "attachment_type": "location",
            "attachment_url": "13.0957,103.2022"  # Battambang
        }
        res = self.client.post("/farmer/support_chat/send", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))

        msg = AdminChatMessage.query.filter_by(sender_id=self.farmer.id).order_by(AdminChatMessage.id.desc()).first()
        self.assertIsNotNone(msg)
        self.assertEqual(msg.attachment_type, "location")
        self.assertEqual(msg.attachment_url, "13.0957,103.2022")
        self.assertTrue("Battambang" in msg.message or "បាត់ដំបង" in msg.message or "Location" in msg.message)

    def test_farmer_location_search(self):
        self._login_farmer()
        res = self.client.get("/farmer/support_chat/location/search?q=Battambang")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)
        self.assertIn("Battambang", data[0].get("name", ""))
        self.assertAlmostEqual(data[0].get("latitude"), 13.0957, places=2)

    def test_server_location_site_setting_fallback(self):
        self._login_farmer()
        from app.models.site_setting import SiteSetting
        # Configure server location setting
        lat_setting = SiteSetting(key="SERVER_LOCATION_LAT", value="13.3671")
        lon_setting = SiteSetting(key="SERVER_LOCATION_LON", value="103.8448")
        name_setting = SiteSetting(key="SERVER_LOCATION_NAME", value="Siem Reap Farm HQ, Cambodia")
        db.session.add_all([lat_setting, lon_setting, name_setting])
        db.session.commit()

        res = self.client.get("/farmer/support_chat/location")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertAlmostEqual(data.get("latitude"), 13.3671, places=3)
        self.assertAlmostEqual(data.get("longitude"), 103.8448, places=3)
        self.assertIn("Siem Reap", data.get("display_name"))


