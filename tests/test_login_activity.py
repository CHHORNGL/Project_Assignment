import unittest
from datetime import datetime, timezone
from flask import Flask, session
from flask_login import LoginManager, UserMixin, login_user

from app.extensions import db
from app.models.audit_log import AuditLog
from app.services.login_activity import (
    list_login_activity,
    revoke_login_activity,
    revoke_all_other_sessions,
    is_activity_revoked,
    _REVOKED_ACTIVITIES,
    _KNOWN_VALID_ACTIVITIES,
)
from app.utils.session_security import _login_device_metadata


class UserStub(UserMixin):
    def __init__(self, user_id=1, username="farmer1"):
        self.id = user_id
        self.username = username

    def has_role(self, role):
        return False


class LoginActivityTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-login-activity-secret",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(self.app)

        login_manager = LoginManager()
        login_manager.init_app(self.app)
        login_manager.user_loader(lambda uid: UserStub(int(uid)))

        # Register routes matching the user and api blueprints
        @self.app.route("/api/login-activity")
        def api_login_activity():
            from app.blueprints.api.routes import login_activity_api
            return login_activity_api()

        @self.app.route("/api/login-activity/revoke", methods=["POST"])
        def api_login_activity_revoke():
            from app.blueprints.api.routes import login_activity_revoke_api
            return login_activity_revoke_api()

        @self.app.route("/api/login-activity/revoke-others", methods=["POST"])
        def api_login_activity_revoke_others():
            from app.blueprints.api.routes import login_activity_revoke_others_api
            return login_activity_revoke_others_api()

        @self.app.route("/users/login-activity/data")
        def users_login_activity_data():
            from app.blueprints.user.routes import login_activity_data
            return login_activity_data()

        @self.app.route("/users/login-activity/revoke", methods=["POST"])
        def users_login_activity_revoke():
            from app.blueprints.user.routes import login_activity_revoke
            return login_activity_revoke()

        @self.app.route("/users/login-activity/revoke-others", methods=["POST"])
        def users_login_activity_revoke_others():
            from app.blueprints.user.routes import login_activity_revoke_others
            return login_activity_revoke_others()

        with self.app.app_context():
            db.create_all()

        _REVOKED_ACTIVITIES.clear()
        _KNOWN_VALID_ACTIVITIES.clear()
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()
        _REVOKED_ACTIVITIES.clear()
        _KNOWN_VALID_ACTIVITIES.clear()

    def test_device_metadata_classification(self):
        cases = [
            (
                {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"},
                "mobile_phone", "Safari", "iOS"
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"},
                "mobile_phone", "Chrome", "Android"
            ),
            (
                {"User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"},
                "tablet", "Safari", "iOS"
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"},
                "laptop_computer", "Chrome", "macOS"
            ),
            (
                {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"},
                "laptop_computer", "Firefox", "Windows"
            ),
            (
                {"X-Client-Platform": "flutter", "User-Agent": "Dart/3.3 (dart:io)"},
                "mobile_phone", "Mobile App", "Flutter"
            ),
            (
                {"User-Agent": "curl/7.88.1"},
                "laptop_computer", "API client", "Unknown"
            ),
        ]

        for headers, expected_device, expected_browser, expected_os in cases:
            with self.subTest(headers=headers):
                with self.app.test_request_context("/login", headers=headers):
                    meta = _login_device_metadata()
                    self.assertEqual(meta["device"], expected_device)
                    self.assertEqual(meta["browser"], expected_browser)
                    self.assertEqual(meta["os"], expected_os)
                    self.assertTrue(len(meta["activity_id"]) > 0)
                    self.assertEqual(meta["login_route"], "/login")

    def test_list_login_activity_empty(self):
        with self.app.app_context():
            activities = list_login_activity(user_id=42)
            self.assertEqual(activities, [])

    def test_list_login_activity_with_records(self):
        with self.app.app_context():
            log1 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=192.168.1.10 rid=req-1 Session initialized activity_id=act_1 device=mobile browser=Mobile_App os=Flutter login_route=/api/login",
                created_at=datetime(2026, 9, 21, 10, 0, 0, tzinfo=timezone.utc),
            )
            log2 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=127.0.0.1 rid=req-2 Session initialized activity_id=act_2 device=desktop browser=Chrome os=macOS login_route=/auth/login",
                created_at=datetime(2026, 9, 21, 8, 0, 0, tzinfo=timezone.utc),
            )
            # Irrelevant audit log for another user / different action
            log3 = AuditLog(
                user_id=2,
                action="AUTH_SESSION_CREATED",
                target_user="farmer2",
                detail="activity_id=act_3 device=desktop browser=Firefox os=Windows",
                created_at=datetime(2026, 9, 21, 9, 0, 0, tzinfo=timezone.utc),
            )
            log4 = AuditLog(
                user_id=1,
                action="AUTH_LOGOUT",
                target_user="farmer1",
                detail="User signed out activity_id=act_2",
                created_at=datetime(2026, 9, 21, 10, 30, 0, tzinfo=timezone.utc),
            )
            db.session.add_all([log1, log2, log3, log4])
            db.session.commit()

            activities = list_login_activity(user_id=1, current_activity_id="act_1")
            self.assertEqual(len(activities), 2)

            first = activities[0]
            self.assertEqual(first["activity_id"], "act_1")
            self.assertEqual(first["device_type"], "Mobile Phone")
            self.assertEqual(first["browser"], "Mobile App")
            self.assertEqual(first["platform"], "Flutter")
            self.assertEqual(first["ip_address"], "192.168.1.10")
            self.assertEqual(first["route"], "/api/login")
            self.assertTrue(first["current"])
            self.assertFalse(first["revoked"])

            second = activities[1]
            self.assertEqual(second["activity_id"], "act_2")
            self.assertEqual(second["device_type"], "Laptop / Computer")
            self.assertEqual(second["browser"], "Chrome")
            self.assertEqual(second["platform"], "macOS")
            self.assertEqual(second["ip_address"], "127.0.0.1")
            self.assertEqual(second["route"], "/auth/login")
            self.assertFalse(second["current"])
            self.assertTrue(second["revoked"])

    def test_revoke_device_and_revoke_others(self):
        with self.app.app_context():
            log1 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=192.168.1.10 Session initialized activity_id=act_1 device=mobile browser=Mobile_App os=Flutter login_route=/api/login",
                created_at=datetime(2026, 9, 21, 10, 0, 0, tzinfo=timezone.utc),
            )
            log2 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=127.0.0.1 Session initialized activity_id=act_2 device=desktop browser=Chrome os=macOS login_route=/auth/login",
                created_at=datetime(2026, 9, 21, 8, 0, 0, tzinfo=timezone.utc),
            )
            log3 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=10.0.0.5 Session initialized activity_id=act_3 device=tablet browser=Safari os=iOS login_route=/auth/login",
                created_at=datetime(2026, 9, 21, 7, 0, 0, tzinfo=timezone.utc),
            )
            db.session.add_all([log1, log2, log3])
            db.session.commit()

            # Revoke act_2
            self.assertFalse(is_activity_revoked("act_2", user_id=1))
            revoked = revoke_login_activity(1, "act_2", actor_username="farmer1")
            self.assertTrue(revoked)
            self.assertTrue(is_activity_revoked("act_2", user_id=1))

            # Revoke all others except act_1 (act_3 should be revoked, act_2 already revoked)
            count = revoke_all_other_sessions(1, "act_1", actor_username="farmer1")
            self.assertEqual(count, 1)
            self.assertTrue(is_activity_revoked("act_3", user_id=1))
            self.assertFalse(is_activity_revoked("act_1", user_id=1))

    def test_api_and_users_revoke_endpoints(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = "1"
            sess["_fresh"] = True
            sess["_login_activity_id"] = "act_1"

        with self.app.app_context():
            log1 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=127.0.0.1 Session initialized activity_id=act_1 device=desktop browser=Chrome os=macOS login_route=/auth/login",
                created_at=datetime.now(timezone.utc),
            )
            log2 = AuditLog(
                user_id=1,
                action="AUTH_SESSION_CREATED",
                target_user="farmer1",
                detail="ip=192.168.1.10 Session initialized activity_id=act_2 device=mobile browser=Mobile_App os=Flutter login_route=/api/login",
                created_at=datetime.now(timezone.utc),
            )
            db.session.add_all([log1, log2])
            db.session.commit()

            # Test API revoke endpoint
            api_resp = self.client.post("/api/login-activity/revoke", json={"activity_id": "act_2"})
            self.assertEqual(api_resp.status_code, 200)
            api_data = api_resp.get_json()
            self.assertTrue(api_data["ok"])
            self.assertTrue(is_activity_revoked("act_2", user_id=1))

            # Test Users revoke-others endpoint
            users_resp = self.client.post("/users/login-activity/revoke-others")
            self.assertEqual(users_resp.status_code, 200)
            users_data = users_resp.get_json()
            self.assertTrue(users_data["ok"])


if __name__ == "__main__":
    unittest.main()
