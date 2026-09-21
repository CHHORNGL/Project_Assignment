import json
import unittest
from flask import Flask, session, request
from flask_login import LoginManager, UserMixin, login_user

from app.extensions import db
from app.models.passkey import UserPasskey
from app.blueprints.auth.routes import auth_bp
from app.blueprints.staff.routes import staff_bp
from app.blueprints.user.routes import user_bp
from app.services.passkey_service import (
    get_webauthn_rp_and_origins,
    get_registration_options_json,
    get_authentication_options_json,
)


class DummyUser(UserMixin):
    def __init__(self, user_id=1, username="testfarmer", full_name="Test Farmer", is_active=True, roles=None):
        self.id = user_id
        self.username = username
        self.full_name = full_name
        self._is_active = is_active
        self.roles = roles or []

    @property
    def is_active(self):
        return self._is_active

    def has_role(self, role_name):
        return any(r == role_name for r in self.roles)


class PasskeyServiceAndRoutesTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-passkey-secret",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            SERVER_NAME="agricultureexp.space",
        )
        db.init_app(self.app)

        self.login_manager = LoginManager()
        self.login_manager.init_app(self.app)

        @self.login_manager.user_loader
        def load_user(uid):
            return DummyUser(int(uid), roles=["farmer"])

        # Register blueprints
        self.app.register_blueprint(auth_bp, url_prefix="/auth")
        self.app.register_blueprint(staff_bp, url_prefix="/staff")
        self.app.register_blueprint(user_bp, url_prefix="/users")

        with self.app.app_context():
            db.create_all()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_rp_id_and_origins_production(self):
        with self.app.test_request_context(
            "/",
            headers={
                "Host": "agricultureexp.space",
                "Origin": "https://agricultureexp.space",
            },
        ):
            rp_id, origins = get_webauthn_rp_and_origins(request)
            self.assertEqual(rp_id, "agricultureexp.space")
            self.assertIn("https://agricultureexp.space", origins)
            self.assertIn("https://www.agricultureexp.space", origins)

    def test_rp_id_and_origins_subdomain(self):
        with self.app.test_request_context(
            "/",
            headers={
                "Host": "www.agricultureexp.space",
                "Origin": "https://www.agricultureexp.space",
            },
        ):
            rp_id, origins = get_webauthn_rp_and_origins(request)
            self.assertEqual(rp_id, "agricultureexp.space")
            self.assertIn("https://agricultureexp.space", origins)
            self.assertIn("https://www.agricultureexp.space", origins)

    def test_rp_id_and_origins_localhost(self):
        with self.app.test_request_context(
            "/",
            headers={
                "Host": "localhost:5000",
                "Origin": "http://localhost:5000",
            },
        ):
            rp_id, origins = get_webauthn_rp_and_origins(request)
            self.assertEqual(rp_id, "localhost")
            self.assertIn("http://localhost:5000", origins)

    def test_rp_id_and_origins_railway(self):
        with self.app.test_request_context(
            "/",
            headers={
                "Host": "my-app.up.railway.app",
                "X-Forwarded-Host": "my-app.up.railway.app",
                "Origin": "https://my-app.up.railway.app",
            },
        ):
            rp_id, origins = get_webauthn_rp_and_origins(request)
            self.assertEqual(rp_id, "my-app.up.railway.app")
            self.assertIn("https://my-app.up.railway.app", origins)

    def test_get_registration_options_json(self):
        user = DummyUser(user_id=42, username="farmer42", full_name="Farmer Jane")
        with self.app.test_request_context(
            "/",
            headers={"Host": "agricultureexp.space"},
        ):
            options_json, challenge_str = get_registration_options_json(user, request)
            self.assertTrue(bool(challenge_str))
            data = json.loads(options_json)
            self.assertEqual(data["rp"]["id"], "agricultureexp.space")
            self.assertEqual(data["user"]["name"], "farmer42")
            self.assertEqual(data["user"]["displayName"], "Farmer Jane")
            self.assertIn("authenticatorSelection", data)
            self.assertEqual(data["authenticatorSelection"]["residentKey"], "preferred")

    def test_get_authentication_options_json(self):
        with self.app.test_request_context(
            "/",
            headers={"Host": "agricultureexp.space"},
        ):
            options_json, challenge_str = get_authentication_options_json(request)
            self.assertTrue(bool(challenge_str))
            data = json.loads(options_json)
            self.assertEqual(data["rpId"], "agricultureexp.space")
            self.assertEqual(data["userVerification"], "preferred")

    def test_auth_passkey_login_options_route(self):
        client = self.app.test_client()
        res = client.get("/auth/passkey/login/options")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["rpId"], "agricultureexp.space")
        with client.session_transaction() as sess:
            self.assertIn("passkey_login_challenge", sess)
            self.assertTrue(bool(sess["passkey_login_challenge"]))

    def test_staff_passkey_login_options_route(self):
        client = self.app.test_client()
        res = client.get("/staff/passkey/login/options")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["rpId"], "agricultureexp.space")
        with client.session_transaction() as sess:
            self.assertIn("staff_passkey_login_challenge", sess)
            self.assertTrue(bool(sess["staff_passkey_login_challenge"]))

    def test_passkey_login_verify_no_challenge(self):
        client = self.app.test_client()
        res = client.post("/auth/passkey/login/verify", json={"id": "nonexistent"})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("expired", data["message"].lower())

    def test_passkey_login_verify_unknown_credential(self):
        client = self.app.test_client()
        with client.session_transaction() as sess:
            sess["passkey_login_challenge"] = "dGVzdGNoYWxsZW5nZQ"

        res = client.post("/auth/passkey/login/verify", json={"id": "unknown-cred-id"})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("not registered", data["message"].lower())

    def test_staff_passkey_login_verify_unknown_credential(self):
        client = self.app.test_client()
        with client.session_transaction() as sess:
            sess["staff_passkey_login_challenge"] = "dGVzdGNoYWxsZW5nZQ"

        res = client.post("/staff/passkey/login/verify", json={"id": "unknown-cred-id"})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["status"], "error")
        self.assertIn("not registered", data["message"].lower())


if __name__ == "__main__":
    unittest.main()
