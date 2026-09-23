import os
import tempfile
import unittest

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"

from app import create_app
from app.extensions import db


class GuestLandingTestCase(unittest.TestCase):
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

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_guest_dashboard_renders_nexusai_landing(self):
        resp = self.client.get("/farmer/dashboard")
        self.assertEqual(resp.status_code, 200)
        html = resp.get_data(as_text=True)

        # NexusAI Landing Wrapper & Aurora Elements
        self.assertIn("nx-landing-wrap", html)
        self.assertIn("nx-aurora-1", html)
        self.assertIn("nx-badge", html)
        self.assertIn("nx-gradient-text", html)

        # Dashboard Window Mockup
        self.assertIn("nx-dwrap", html)
        self.assertIn("nx-dtbar", html)
        self.assertIn("nxLiveActivity", html)
        self.assertIn("nxInteractiveChat", html)
        self.assertIn("nxChatBody", html)
        self.assertIn("nxChatInput", html)
        self.assertIn("nxChatSendBtn", html)

        # Sample Crop Showcase & How It Works
        self.assertIn("nxWorkflow", html)
        self.assertIn("nxSampleReport", html)
        self.assertIn('data-crop="rice"', html)
        self.assertIn('data-crop="cassava"', html)

        # Pricing Tiers & Billing Switch
        self.assertIn("nxPricing", html)
        self.assertIn("nxPriceToggle", html)
        self.assertIn("nxProPlanPrice", html)

        # Offcanvas Drawer Removed for Clean Professional UI (Direct Auth Navigation)
        self.assertNotIn("nxOffcanvas", html)
        self.assertIn("/auth/login", html)
        self.assertIn("/auth/register", html)

        # Single Navigation Bar (no second farmer-topnav for guests)
        self.assertNotIn("farmer-topnav", html)

        # Project Details Shown in Body
        self.assertIn("nxProjectDetail", html)
        self.assertIn("Sek Socheat", html)
        self.assertIn("Mao Seavik", html)

        # 3D Interactive AI Agronomy Scanner & Hologram
        self.assertIn("nx3DShowcase", html)
        self.assertIn("nx3dCanvas", html)
        self.assertIn("nx3dViewport", html)
        self.assertIn("nx3dScene", html)
        self.assertIn("nx3dLaser", html)
        self.assertIn("nx3dCardLeft", html)
        self.assertIn("nx3dCardRight", html)

        # FAQ Accordion
        self.assertIn("nxFaqAccordion", html)

    def test_guest_chat_endpoint_responds_and_enforces_limit(self):
        # 1. Successful inquiry
        res = self.client.post("/farmer/guest-chat", json={"message": "What is Rice Blast?"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertIn("Rice Blast", data.get("reply"))
        self.assertEqual(data.get("remaining"), 4)

        # 2. Inquiries up to limit
        for i in range(4):
            res = self.client.post("/farmer/guest-chat", json={"message": f"Inquiry {i+2}"})
            self.assertEqual(res.status_code, 200)

        # 6th inquiry should trigger limit
        res_limit = self.client.post("/farmer/guest-chat", json={"message": "Exceeded question"})
        self.assertEqual(res_limit.status_code, 200)
        limit_data = res_limit.get_json()
        self.assertTrue(limit_data.get("limit_reached"))
        self.assertIn("Create a free account", limit_data.get("reply"))

    def test_guest_to_authenticated_ajax_register_and_login(self):
        # 1. Register with invalid email
        res = self.client.post("/auth/ajax-register", json={
            "full_name": "Test Farmer",
            "email": "invalid-email",
            "password": "secretpassword"
        })
        self.assertEqual(res.status_code, 400)

        # 2. Register with short password
        res = self.client.post("/auth/ajax-register", json={
            "full_name": "Test Farmer",
            "email": "farmer1@example.com",
            "password": "123"
        })
        self.assertEqual(res.status_code, 400)

        # 3. Successful registration
        res = self.client.post("/auth/ajax-register", json={
            "full_name": "Test Farmer",
            "email": "farmer1@example.com",
            "password": "secretpassword"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("redirect"), "/farmer/dashboard")

        # 4. Logout and attempt duplicate registration with existing email
        self.client.get("/auth/logout")
        res = self.client.post("/auth/ajax-register", json={
            "full_name": "Test Farmer 2",
            "email": "farmer1@example.com",
            "password": "secretpassword"
        })
        self.assertEqual(res.status_code, 400)

        # 5. Logout
        self.client.get("/auth/logout")

        # 6. AJAX Login with wrong password
        res = self.client.post("/auth/ajax-login", json={
            "email": "farmer1@example.com",
            "password": "wrongpassword"
        })
        self.assertEqual(res.status_code, 401)

        # 7. AJAX Login with correct password
        res = self.client.post("/auth/ajax-login", json={
            "email": "farmer1@example.com",
            "password": "secretpassword"
        })
        self.assertEqual(res.status_code, 200)
        login_data = res.get_json()
        self.assertTrue(login_data.get("success"))
        self.assertEqual(login_data.get("redirect"), "/farmer/dashboard")


if __name__ == "__main__":
    unittest.main()
