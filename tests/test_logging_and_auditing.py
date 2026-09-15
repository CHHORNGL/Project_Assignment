import io
import logging
import unittest
from unittest.mock import patch

from flask import Flask, g
from werkzeug.exceptions import BadRequest

from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.role import Role
from app.utils.audit import audit_log, log_action, redact_sensitive


class LoggingAndAuditingTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY="test-secret-audit-key",
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db.init_app(self.app)

        with self.app.app_context():
            db.create_all()
            user = User(
                username="audit_farmer",
                email="farmer@audit.test",
                is_active=True,
                is_verified=True,
            )
            user.set_password("CorrectPassword123")
            db.session.add(user)
            db.session.commit()
            self.user_id = user.id

        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_credential_redaction(self):
        cases = [
            ("password=MyPassword123", "password=[REDACTED]"),
            ("token=secret_jwt_token_here", "token=[REDACTED]"),
            ("code=123456", "code=[REDACTED]"),
            ("otp=987654 email=user@test.com", "otp=[REDACTED] email=user@test.com"),
            ("bearer=eyJhbGciOi", "bearer=[REDACTED]"),
            ("safe detail about user update", "safe detail about user update"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(redact_sensitive(raw), expected)

    def test_authenticated_audit_event(self):
        with self.app.test_request_context("/login", method="POST"):
            g.request_id = "req-test-123"
            entry = audit_log(
                "AUTH_LOGIN_SUCCESS",
                target_user="audit_farmer",
                detail="User logged in via credentials",
                user_id=self.user_id,
            )
            self.assertIsNotNone(entry)
            self.assertEqual(entry.action, "AUTH_LOGIN_SUCCESS")
            self.assertEqual(entry.user_id, self.user_id)
            self.assertEqual(entry.target_user, "audit_farmer")
            self.assertIn("rid=req-test-123", entry.detail)
            self.assertIn("User logged in via credentials", entry.detail)

    def test_unauthenticated_security_audit_event(self):
        with self.app.test_request_context("/login", method="POST"):
            g.request_id = "req-failed-456"
            entry = audit_log(
                "AUTH_LOGIN_FAILURE",
                target_user="unknown@test.com",
                detail="password=AttackerPassword",
                user_id=None,
                status="FAILURE",
                severity="WARNING",
            )
            self.assertIsNotNone(entry)
            self.assertIsNone(entry.user_id)
            self.assertEqual(entry.action, "AUTH_LOGIN_FAILURE")
            self.assertEqual(entry.target_user, "unknown@test.com")
            self.assertIn("status=FAILURE", entry.detail)
            self.assertIn("password=[REDACTED]", entry.detail)
            self.assertNotIn("AttackerPassword", entry.detail)

    def test_backward_compatible_log_action(self):
        with self.app.app_context():
            user = db.session.get(User, self.user_id)

            # Legacy signature 1: log_action(admin_user, action, target_user, detail)
            entry1 = log_action(user, "USER_BAN", "bad_actor", "Violated terms")
            self.assertIsNotNone(entry1)
            self.assertEqual(entry1.action, "USER_BAN")
            self.assertEqual(entry1.user_id, self.user_id)
            self.assertEqual(entry1.target_user, "bad_actor")

            # Legacy signature 2: log_action(action, target_user, detail)
            entry2 = log_action("SYSTEM_BACKUP", "system", "Daily automated backup")
            self.assertIsNotNone(entry2)
            self.assertEqual(entry2.action, "SYSTEM_BACKUP")
            self.assertEqual(entry2.target_user, "system")

    def test_failsafe_database_error_handling(self):
        with self.app.test_request_context():
            with patch("app.utils.audit.db.session.commit", side_effect=RuntimeError("DB disk full")):
                entry = audit_log("FAIL_SAFE_TEST", detail="Testing exception handling")
                # Must return None safely without raising an exception
                self.assertIsNone(entry)

    def test_logger_stream_emittance(self):
        log_stream = io.StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.setFormatter(logging.Formatter("%(message)s"))
        audit_logger = logging.getLogger("security.audit")
        audit_logger.addHandler(handler)
        audit_logger.setLevel(logging.INFO)

        try:
            with self.app.test_request_context("/api/sensitive", method="GET"):
                g.request_id = "corr-999"
                audit_log(
                    "SECURITY_RATE_LIMIT_EXCEEDED",
                    detail="limit=5 per minute",
                    status="BLOCKED",
                    severity="WARNING",
                )
            output = log_stream.getvalue()
            self.assertIn("[corr-999]", output)
            self.assertIn("SECURITY_RATE_LIMIT_EXCEEDED", output)
            self.assertIn("status=BLOCKED", output)
        finally:
            audit_logger.removeHandler(handler)


if __name__ == "__main__":
    unittest.main()
