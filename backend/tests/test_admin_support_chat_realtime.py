# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import os
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
from app.models.role import Role
from app.models.user import User
from app.utils.session_security import credential_stamp


class AdminSupportChatRealtimeTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update({"TESTING": True, "WTF_CSRF_ENABLED": False})

    @classmethod
    def tearDownClass(cls):
        try:
            os.close(_test_db_fd)
            os.unlink(_test_db_path)
        except OSError:
            pass

    def setUp(self):
        with self.app.app_context():
            db.create_all()

            farmer_role = Role(name="farmer", route_type="farmer")
            admin_role = Role(name="admin", route_type="admin")
            db.session.add_all([farmer_role, admin_role])

            self.farmer = User(username="rt_farmer", full_name="Farmer Real", email="rf@example.com")
            self.farmer.set_password("secret123")
            self.farmer.roles.append(farmer_role)

            self.admin = User(username="rt_admin", full_name="Admin Real", email="ra@example.com")
            self.admin.set_password("secret123")
            self.admin.roles.append(admin_role)

            db.session.add_all([self.farmer, self.admin])
            db.session.commit()
            self.farmer_id = self.farmer.id
            self.admin_id = self.admin.id
            farmer_stamp = credential_stamp(self.farmer)
            admin_stamp = credential_stamp(self.admin)

        self.farmer_client = self.app.test_client()
        self.admin_client = self.app.test_client()
        self._login(self.farmer_client, self.farmer_id, farmer_stamp)
        self._login(self.admin_client, self.admin_id, admin_stamp)

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def _login(self, client, user_id: int, stamp: str):
        with client.session_transaction() as sess:
            sess.clear()
            sess["_user_id"] = str(user_id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = stamp

    def test_live_envelope_delta_typing_and_read_receipts(self):
        # 1. Farmer sends initial message and emits typing heartbeat
        send_f = self.farmer_client.post("/farmer/support_chat/send", json={"message": "Need live help!"})
        self.assertEqual(send_f.status_code, 200)
        self.assertTrue(send_f.get_json()["success"])
        first_msg_id = send_f.get_json()["message"]["id"]

        # Farmer starts typing again
        self.farmer_client.post("/farmer/support_chat/typing")

        # 2. Admin checks conversations: farmer unread = 1, admin outgoing = not counted
        conv_res = self.admin_client.get("/admin/support_chat/conversations")
        self.assertEqual(conv_res.status_code, 200)
        conv = conv_res.get_json()
        self.assertEqual(conv["total_unread"], 1)
        self.assertEqual(conv["conversations"][0]["role"], "farmer")
        self.assertTrue(conv["conversations"][0]["is_typing"])

        # 3. Admin fetches envelope with full thread -> partner_typing True & message marked read
        env1 = self.admin_client.get(f"/admin/support_chat/{self.farmer_id}/messages?envelope=1").get_json()
        self.assertEqual(len(env1["messages"]), 1)
        self.assertTrue(env1["partner_typing"])

        # 4. Admin replies & emits typing; reply id returned directly
        send_a = self.admin_client.post(
            f"/admin/support_chat/{self.farmer_id}/send",
            json={"message": "On it! Checking your field."},
        ).get_json()
        self.assertTrue(send_a["success"])
        admin_msg_id = send_a["message"]["id"]

        # Delta poll for admin returns only messages after admin_msg_id (empty right now)
        env2 = self.admin_client.get(
            f"/admin/support_chat/{self.farmer_id}/messages?envelope=1&after_id={admin_msg_id}"
        ).get_json()
        self.assertEqual(env2["messages"], [])
        self.assertNotIn(admin_msg_id, env2["read_ids"])

        # 5. Farmer polls messages -> marks admin reply as read
        f_env = self.farmer_client.get(
            f"/farmer/support_chat/messages?envelope=1&after_id={first_msg_id}"
        ).get_json()
        self.assertEqual(len(f_env["messages"]), 1)
        self.assertEqual(f_env["messages"][0]["id"], admin_msg_id)

        # 6. Admin delta poll now observes read_ids containing admin_msg_id
        env3 = self.admin_client.get(
            f"/admin/support_chat/{self.farmer_id}/messages?envelope=1&after_id={admin_msg_id}"
        ).get_json()
        self.assertIn(admin_msg_id, env3["read_ids"])


if __name__ == "__main__":
    unittest.main()
