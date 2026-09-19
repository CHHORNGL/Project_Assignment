import os
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone

# Ensure in-memory/temp sqlite is used for database initialization
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from app.models.chat_session import ChatSession
from app.models.chat_message import ChatMessage
from app.utils.session_security import credential_stamp


class FarmerAiHistoryTestCase(unittest.TestCase):
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
        db.session.add(farmer_role)

        self.user = User(username="testfarmer", email="testfarmer@example.com")
        self.user.set_password("secret123")
        self.user.roles.append(farmer_role)
        db.session.add(self.user)
        db.session.commit()

        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.user.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.user)

    def test_anonymous_redirect(self):
        res = self.client.get("/farmer/history/ai")
        self.assertEqual(res.status_code, 302)
        self.assertIn("/auth/login", res.headers.get("Location", ""))

    def test_empty_history(self):
        self._login()
        res = self.client.get("/farmer/history/ai")
        self.assertEqual(res.status_code, 200)
        content = res.data.decode("utf-8")
        self.assertIn("fm-history-empty", content)

    def test_populated_history_renders_cleanly(self):
        self._login()

        # Session 1: Today
        s1 = ChatSession(farmer_id=self.user.id, title="Rice Blast Disease", session_type="ai")
        db.session.add(s1)
        db.session.commit()

        m1 = ChatMessage(farmer_id=self.user.id, session_id=s1.id, sender="farmer", message="My rice has brown spots")
        m2 = ChatMessage(farmer_id=self.user.id, session_id=s1.id, sender="expert", message="Apply Tricyclazole early in the morning")
        db.session.add_all([m1, m2])

        # Session 2: Yesterday
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        s2 = ChatSession(farmer_id=self.user.id, title="Tomato pests", session_type="ai", updated_at=yesterday, created_at=yesterday)
        db.session.add(s2)
        db.session.commit()

        m3 = ChatMessage(farmer_id=self.user.id, session_id=s2.id, sender="farmer", message="Tomato leaf aphids", created_at=yesterday)
        db.session.add(m3)
        db.session.commit()

        res = self.client.get("/farmer/history/ai")
        self.assertEqual(res.status_code, 200)
        content = res.data.decode("utf-8")
        self.assertIn("Rice Blast Disease", content)
        self.assertIn("Apply Tricyclazole early in the morning", content)
        self.assertIn("Tomato pests", content)
        self.assertIn("history-search-input", content)
        self.assertNotIn("builtin_function_or_method", content)


if __name__ == "__main__":
    unittest.main()
