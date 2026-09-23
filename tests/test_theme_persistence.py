import unittest
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role


class ThemePersistenceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Create test roles and users
        self.farmer_role = Role.query.filter_by(name="farmer").first()
        if not self.farmer_role:
            self.farmer_role = Role(name="farmer", route_type="farmer")
            db.session.add(self.farmer_role)

        self.admin_role = Role.query.filter_by(name="admin").first()
        if not self.admin_role:
            self.admin_role = Role(name="admin", route_type="admin")
            db.session.add(self.admin_role)

        self.expert_role = Role.query.filter_by(name="expert").first()
        if not self.expert_role:
            self.expert_role = Role(name="expert", route_type="expert")
            db.session.add(self.expert_role)

        db.session.commit()

        # Setup test farmer
        self.farmer_user = User.query.filter_by(email="test_farmer_theme@example.com").first()
        if not self.farmer_user:
            self.farmer_user = User(
                username="testfarmertheme",
                email="test_farmer_theme@example.com",
                is_active=True,
                is_verified=True,
                theme="light"
            )
            self.farmer_user.set_password("Password123!")
            self.farmer_user.roles.append(self.farmer_role)
            db.session.add(self.farmer_user)
            db.session.commit()

        # Setup test admin
        self.admin_user = User.query.filter_by(email="test_admin_theme@example.com").first()
        if not self.admin_user:
            self.admin_user = User(
                username="testadmintheme",
                email="test_admin_theme@example.com",
                is_active=True,
                is_verified=True,
                theme="light"
            )
            self.admin_user.set_password("Password123!")
            self.admin_user.roles.append(self.admin_role)
            db.session.add(self.admin_user)
            db.session.commit()

        # Setup test expert
        self.expert_user = User.query.filter_by(email="test_expert_theme@example.com").first()
        if not self.expert_user:
            self.expert_user = User(
                username="testexperttheme",
                email="test_expert_theme@example.com",
                is_active=True,
                is_verified=True,
                theme="light"
            )
            self.expert_user.set_password("Password123!")
            self.expert_user.roles.append(self.expert_role)
            db.session.add(self.expert_user)
            db.session.commit()

    def tearDown(self):
        self.app_context.pop()

    def test_guest_user_post_theme_sets_cookie_and_session(self):
        """Guest posting to /users/theme must return theme cookie and 200 OK."""
        res = self.client.post(
            "/users/theme",
            json={"theme": "dark"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("theme"), "dark")

        # Verify cookie header
        set_cookie = res.headers.get("Set-Cookie", "")
        self.assertIn("theme=dark", set_cookie)

    def test_theme_partials_in_guest_and_auth_templates(self):
        """Verify theme partials are embedded into landing, login, register, and staff login."""
        # 1. Farmer guest landing
        res = self.client.get("/farmer/dashboard")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn("UNIFIED NO-FLASH THEME LOADER", html)
        self.assertIn("UNIFIED THEME SYNCHRONIZATION", html)

        # 2. Login page
        res = self.client.get("/auth/login")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn("UNIFIED NO-FLASH THEME LOADER", html)
        self.assertIn("UNIFIED THEME SYNCHRONIZATION", html)

        # 3. Register page
        res = self.client.get("/auth/register")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn("UNIFIED NO-FLASH THEME LOADER", html)
        self.assertIn("UNIFIED THEME SYNCHRONIZATION", html)

        # 4. Staff login
        res = self.client.get("/staff/login")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        self.assertIn("UNIFIED NO-FLASH THEME LOADER", html)
        self.assertIn("UNIFIED THEME SYNCHRONIZATION", html)

    def test_guest_theme_cookie_syncs_to_farmer_on_login(self):
        """When a guest has dark mode cookie and logs in as farmer, user.theme must update to dark."""
        self.farmer_user.theme = "light"
        db.session.commit()

        # Guest visits with theme=dark cookie
        self.client.set_cookie("theme", "dark")

        login_res = self.client.post(
            "/auth/login",
            data={
                "email": "test_farmer_theme@example.com",
                "password": "Password123!"
            },
            follow_redirects=False
        )
        self.assertEqual(login_res.status_code, 302)

        # Reload user from DB and check theme
        refreshed_user = User.query.filter_by(email="test_farmer_theme@example.com").first()
        self.assertEqual(refreshed_user.theme, "dark")

    def test_guest_theme_cookie_syncs_to_admin_on_staff_login(self):
        """When a guest has dark mode cookie and logs in via staff portal, user.theme must update to dark."""
        self.admin_user.theme = "light"
        db.session.commit()

        # Guest visits with theme=dark cookie
        self.client.set_cookie("theme", "dark")

        login_res = self.client.post(
            "/staff/login",
            data={
                "email": "test_admin_theme@example.com",
                "password": "Password123!"
            },
            follow_redirects=False
        )
        self.assertEqual(login_res.status_code, 302)

        # Reload admin from DB and check theme
        refreshed_admin = User.query.filter_by(email="test_admin_theme@example.com").first()
        self.assertEqual(refreshed_admin.theme, "dark")

    def test_ajax_login_preserves_theme_and_returns_cookie(self):
        """AJAX login endpoint should sync theme and return Set-Cookie."""
        self.farmer_user.theme = "light"
        db.session.commit()

        self.client.set_cookie("theme", "dark")
        res = self.client.post(
            "/auth/ajax-login",
            json={
                "email": "test_farmer_theme@example.com",
                "password": "Password123!"
            }
        )
        self.assertEqual(res.status_code, 200)
        set_cookie = res.headers.get("Set-Cookie", "")
        self.assertIn("theme=dark", set_cookie)

        refreshed_user = User.query.filter_by(email="test_farmer_theme@example.com").first()
        self.assertEqual(refreshed_user.theme, "dark")

    def test_server_rendered_theme_classes_for_dark_mode_guest(self):
        """Guest with theme=dark cookie must receive server-side dark-mode class in html and body."""
        self.client.set_cookie("theme", "dark")
        urls = [
            "/farmer/dashboard",
            "/auth/login",
            "/auth/register",
            "/auth/forgot-password",
            "/staff/login",
        ]
        for url in urls:
            res = self.client.get(url)
            self.assertEqual(res.status_code, 200, f"URL {url} failed with {res.status_code}")
            html = res.data.decode("utf-8")
            self.assertIn('class="dark-mode auth-panel-dark"', html, f"HTML class missing dark-mode in {url}")
            self.assertIn("dark-mode", html, f"dark-mode missing in {url}")

    def test_server_rendered_theme_classes_for_light_mode_guest(self):
        """Guest with theme=light cookie must not receive dark-mode class."""
        self.client.set_cookie("theme", "light")
        res = self.client.get("/farmer/dashboard")
        self.assertEqual(res.status_code, 200)
        html = res.data.decode("utf-8")
        # html tag should have empty class or not dark-mode
        self.assertNotIn('<html lang="en" class="dark-mode', html)

    def test_logout_preserves_theme_cookie_and_session(self):
        """Logout must set theme cookie and session so guest retains active theme."""
        # 1. Login as farmer
        self.farmer_user.theme = "dark"
        db.session.commit()
        self.client.set_cookie("theme", "dark")
        self.client.post(
            "/auth/login",
            data={"email": "test_farmer_theme@example.com", "password": "Password123!"},
            follow_redirects=True
        )

        # 2. Logout
        logout_res = self.client.get("/auth/logout", follow_redirects=False)
        self.assertEqual(logout_res.status_code, 302)
        set_cookie = logout_res.headers.get("Set-Cookie", "")
        self.assertIn("theme=dark", set_cookie)

    def test_expert_login_syncs_theme_cookie(self):
        """When guest visits with dark theme and logs in as expert, user.theme becomes dark."""
        self.expert_user.theme = "light"
        db.session.commit()

        self.client.set_cookie("theme", "dark")
        res = self.client.post(
            "/staff/login",
            data={"email": "test_expert_theme@example.com", "password": "Password123!"},
            follow_redirects=False
        )
        self.assertEqual(res.status_code, 302)
        refreshed_expert = User.query.filter_by(email="test_expert_theme@example.com").first()
        self.assertEqual(refreshed_expert.theme, "dark")

    def test_user_theme_get_and_post_with_next_url(self):
        """GET /users/theme with next parameter should redirect with cookie set."""
        res = self.client.get("/users/theme?theme=dark&next=/farmer/dashboard")
        self.assertEqual(res.status_code, 302)
        self.assertEqual(res.headers.get("Location"), "/farmer/dashboard")
        set_cookie = res.headers.get("Set-Cookie", "")
        self.assertIn("theme=dark", set_cookie)

    def test_farmer_settings_post_persists_theme(self):
        """Farmer updating theme in settings saves to DB and returns Set-Cookie."""
        # Login first
        self.client.post(
            "/auth/login",
            data={"email": "test_farmer_theme@example.com", "password": "Password123!"},
            follow_redirects=True
        )
        res = self.client.post(
            "/users/settings",
            data={"theme": "dark"},
            follow_redirects=False
        )
        self.assertEqual(res.status_code, 302)
        set_cookie = res.headers.get("Set-Cookie", "")
        self.assertIn("theme=dark", set_cookie)
        refreshed_user = User.query.filter_by(email="test_farmer_theme@example.com").first()
        self.assertEqual(refreshed_user.theme, "dark")


if __name__ == "__main__":
    unittest.main()
