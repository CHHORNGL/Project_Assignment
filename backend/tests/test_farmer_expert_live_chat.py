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
import time
import unittest
from unittest.mock import patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.utils.session_security import credential_stamp


def _extract_bootstrap(html: str) -> dict:
    match = re.search(r'<script id="app-bootstrap" type="application/json">(.*?)</script>', html, re.S)
    assert match, "app-bootstrap JSON payload missing from rendered HTML"
    return json.loads(match.group(1))


class FarmerExpertLiveChatTestCase(unittest.TestCase):
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
            expert_role = Role(name="expert", route_type="expert")
            db.session.add_all([farmer_role, admin_role, expert_role])

            self.farmer = User(username="live_farmer", full_name="Dara Farmer", email="df@example.com")
            self.farmer.set_password("secret123")
            self.farmer.roles.append(farmer_role)

            self.admin = User(username="live_admin", full_name="Seavik Admin", email="sa@example.com")
            self.admin.set_password("secret123")
            self.admin.roles.append(admin_role)

            self.expert_one = User(username="live_expert1", full_name="Dr. Rotha", email="e1@example.com")
            self.expert_one.set_password("secret123")
            self.expert_one.roles.append(expert_role)

            self.expert_two = User(username="live_expert2", full_name="Dr. Vanna", email="e2@example.com")
            self.expert_two.set_password("secret123")
            self.expert_two.roles.append(expert_role)

            db.session.add_all([self.farmer, self.admin, self.expert_one, self.expert_two])
            db.session.commit()

            self.farmer_id = self.farmer.id
            self.admin_id = self.admin.id
            self.expert1_id = self.expert_one.id
            self.expert2_id = self.expert_two.id

            farmer_stamp = credential_stamp(self.farmer)
            admin_stamp = credential_stamp(self.admin)
            expert1_stamp = credential_stamp(self.expert_one)

        self.farmer_client = self.app.test_client()
        self.admin_client = self.app.test_client()
        self.expert_client = self.app.test_client()

        self._login(self.farmer_client, self.farmer_id, farmer_stamp)
        self._login(self.admin_client, self.admin_id, admin_stamp)
        self._login(self.expert_client, self.expert1_id, expert1_stamp)

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

    def test_farmer_live_chat_page_and_channels_summary(self):
        page_res = self.farmer_client.get("/farmer/live-chat?target=expert")
        self.assertEqual(page_res.status_code, 200)
        bootstrap = _extract_bootstrap(page_res.get_data(as_text=True))
        self.assertEqual(bootstrap["page"]["id"], "farmer-live-chat")
        self.assertEqual(bootstrap["data"]["initialTarget"], "expert")
        channels = bootstrap["data"]["channels"]
        self.assertTrue(channels["admin"]["available"])
        self.assertTrue(channels["expert"]["available"])
        self.assertEqual(len(channels["expert"]["recipients"]), 2)

        api_res = self.farmer_client.get("/farmer/support_chat/channels")
        self.assertEqual(api_res.status_code, 200)
        api_channels = api_res.get_json()["channels"]
        self.assertEqual(api_channels["admin"]["recipients"][0]["id"], self.admin_id)
        self.assertEqual(len(api_channels["expert"]["recipients"]), 2)

    def test_admin_and_expert_channels_are_strictly_isolated(self):
        # Farmer sends an account issue to Admin
        send_admin = self.farmer_client.post(
            "/farmer/support_chat/send",
            json={"target": "admin", "message": "Please check my billing status"},
        )
        self.assertEqual(send_admin.status_code, 200)
        admin_msg = send_admin.get_json()["message"]
        self.assertEqual(admin_msg["receiver_id"], self.admin_id)

        # Farmer emits typing directly to Expert 1 and Expert 1 sees it immediately
        self.farmer_client.post(
            "/farmer/support_chat/typing",
            json={"target": "expert", "recipient_id": self.expert1_id},
        )
        typing_env = self.expert_client.get(
            f"/expert/support_chat/{self.farmer_id}/messages?envelope=1"
        ).get_json()
        self.assertTrue(typing_env["partner_typing"])

        # Farmer sends a crop question directly to a specific Expert (Dr. Vanna)
        send_expert = self.farmer_client.post(
            "/farmer/support_chat/send",
            json={
                "target": "expert",
                "recipient_id": self.expert2_id,
                "message": "Brown spots on rice leaves — what should I spray?",
            },
        )
        self.assertEqual(send_expert.status_code, 200)
        expert_msg = send_expert.get_json()["message"]
        self.assertEqual(expert_msg["receiver_id"], self.expert2_id)

        # Verify Admin inbox sees ONLY Admin message and Expert inbox sees ONLY Expert message (with typing cleared after send)
        admin_thread = self.admin_client.get(
            f"/admin/support_chat/{self.farmer_id}/messages?envelope=1"
        ).get_json()
        self.assertEqual([m["id"] for m in admin_thread["messages"]], [admin_msg["id"]])

        expert_thread = self.expert_client.get(
            f"/expert/support_chat/{self.farmer_id}/messages?envelope=1"
        ).get_json()
        self.assertEqual([m["id"] for m in expert_thread["messages"]], [expert_msg["id"]])
        self.assertFalse(expert_thread["partner_typing"])

        # Farmer checks Admin channel vs Expert channel separately
        farmer_admin = self.farmer_client.get(
            "/farmer/support_chat/messages?target=admin&envelope=1"
        ).get_json()
        self.assertEqual([m["id"] for m in farmer_admin["messages"]], [admin_msg["id"]])

        farmer_expert = self.farmer_client.get(
            "/farmer/support_chat/messages?target=expert&envelope=1"
        ).get_json()
        self.assertEqual([m["id"] for m in farmer_expert["messages"]], [expert_msg["id"]])
        self.assertEqual([expert_msg["id"]], farmer_expert["read_ids"])

        # Verify Notifications point each role to their own inbox
        with self.app.app_context():
            expert2_notif = Notification.query.filter_by(
                user_id=self.expert2_id, kind="support_chat"
            ).first()
            self.assertIsNotNone(expert2_notif)
            self.assertEqual(expert2_notif.url, "/expert/support_chats")

    def test_expert_inbox_page_typing_reply_and_channel_unread_badges(self):
        # Expert page renders React expert-support-chats bootstrap
        inbox_res = self.expert_client.get("/expert/support_chats")
        self.assertEqual(inbox_res.status_code, 200)
        bootstrap = _extract_bootstrap(inbox_res.get_data(as_text=True))
        self.assertEqual(bootstrap["page"]["id"], "expert-support-chats")
        self.assertEqual(
            bootstrap["data"]["endpoints"]["conversations"],
            "/expert/support_chat/conversations",
        )

        # Expert replies directly to Farmer and sets typing indicator
        self.expert_client.post(f"/expert/support_chat/{self.farmer_id}/typing")
        reply_res = self.expert_client.post(
            f"/expert/support_chat/{self.farmer_id}/send",
            json={"message": "Use Trichoderma and avoid excess nitrogen."},
        )
        self.assertEqual(reply_res.status_code, 200)
        reply_msg = reply_res.get_json()["message"]

        # Unread badge shows 1 under expert channel and 0 under admin channel
        chan_before = self.farmer_client.get("/farmer/support_chat/channels").get_json()["channels"]
        self.assertEqual(chan_before["expert"]["unreadCount"], 1)
        self.assertEqual(chan_before["admin"]["unreadCount"], 0)

        # Typing indicator is visible only on expert channel while admin stays silent
        self.expert_client.post(f"/expert/support_chat/{self.farmer_id}/typing")
        env_admin = self.farmer_client.get(
            "/farmer/support_chat/messages?target=admin&envelope=1"
        ).get_json()
        self.assertFalse(env_admin["partner_typing"])
        self.assertEqual(env_admin["messages"], [])

        # Reading expert channel marks expert reply read and resets unreadCount to 0
        env_expert = self.farmer_client.get(
            "/farmer/support_chat/messages?target=expert&envelope=1"
        ).get_json()
        self.assertTrue(env_expert["partner_typing"])
        self.assertEqual([m["id"] for m in env_expert["messages"]], [reply_msg["id"]])

        chan_after = self.farmer_client.get("/farmer/support_chat/channels").get_json()["channels"]
        self.assertEqual(chan_after["expert"]["unreadCount"], 0)

        # Expert sees farmer read receipt
        expert_env = self.expert_client.get(
            f"/expert/support_chat/{self.farmer_id}/messages?envelope=1"
        ).get_json()
        self.assertIn(reply_msg["id"], expert_env["read_ids"])

    def test_role_guard_and_empty_message_validation(self):
        denied = self.farmer_client.get("/expert/support_chat/conversations")
        self.assertIn(denied.status_code, (302, 403))

        empty_res = self.farmer_client.post(
            "/farmer/support_chat/send",
            json={"target": "expert", "message": "   "},
        )
        self.assertEqual(empty_res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
