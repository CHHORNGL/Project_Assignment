# ruff: noqa: E402, I001
import json
import os
import pathlib as _pathlib
import re
import sys as _sys
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.config import Config
from app.extensions import db
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User
from app.services.notification_service import notify_user, serialize_notification
from app.utils.session_security import credential_stamp


class NotificationsFlowTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
            HF_INFERENCE_URL="",
            HUGGINGFACE_INFERENCE_URL="",
        ):
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

        farmer_role = Role(name="farmer", route_type="farmer")
        db.session.add(farmer_role)
        db.session.flush()

        self.farmer = User(username="notif_farmer", email="notif_farmer@example.com")
        self.farmer.set_password("StrongPass!123")
        self.farmer.roles.append(farmer_role)
        db.session.add(self.farmer)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login(self):
        with self.client.session_transaction() as sess:
            sess["_user_id"] = str(self.farmer.id)
            sess["_fresh"] = True
            sess["_authenticated_at"] = time.time()
            sess["_last_seen_at"] = time.time()
            sess["_credential_stamp"] = credential_stamp(self.farmer)

    def test_serialize_notification_exposes_compatible_ui_fields(self):
        now = datetime.utcnow()
        n = notify_user(
            user_id=self.farmer.id,
            kind="diagnosis_approved",
            title="Diagnosis Approved",
            subtitle="Rice Blast confirmed by agronomist.",
            url="/farmer/result/42",
            level="success",
            created_at=now - timedelta(minutes=10),
        )
        db.session.commit()

        payload = serialize_notification(n)
        self.assertEqual(payload["kind"], "diagnosis_approved")
        self.assertEqual(payload["subtitle"], "Rice Blast confirmed by agronomist.")
        self.assertEqual(payload["message"], "Rice Blast confirmed by agronomist.")
        self.assertEqual(payload["url"], "/farmer/result/42")
        self.assertEqual(payload["link"], "/farmer/result/42")
        self.assertTrue(payload["unread"])
        self.assertFalse(payload["is_read"])
        self.assertTrue(str(payload["created_at"]).endswith("Z"))

    def test_farmer_and_user_notification_endpoints_counts_and_seen(self):
        now = datetime.utcnow()
        n1 = notify_user(
            user_id=self.farmer.id,
            kind="support_chat",
            title="Expert replied",
            subtitle="Check copper fungicide dosage.",
            url="/farmer/chat?session=1",
            level="info",
            created_at=now,
        )
        n2 = notify_user(
            user_id=self.farmer.id,
            kind="premium_upgrade",
            title="VIP Active",
            subtitle="Your Bakong membership is active.",
            url="/farmer/dashboard",
            level="success",
            created_at=now - timedelta(hours=2),
        )
        db.session.commit()
        n2_id = n2.id
        n1_id = n1.id

        self._login()

        # Page bootstrap carries accurate totals and normalized items
        page_resp = self.client.get("/farmer/notifications")
        self.assertEqual(page_resp.status_code, 200)
        m = re.search(
            r'<script id="app-bootstrap" type="application/json">(.*?)</script>',
            page_resp.get_data(as_text=True),
            re.DOTALL,
        )
        self.assertIsNotNone(m)
        boot = json.loads(m.group(1))
        self.assertEqual(boot["page"]["id"], "user-notifications")
        self.assertEqual(boot["data"]["totalCount"], 2)
        self.assertEqual(boot["data"]["unreadCount"], 2)
        self.assertEqual(len(boot["data"]["items"]), 2)

        # Invalid ids must not mark all notifications as read
        bad_seen = self.client.post("/farmer/notifications/seen", json={"ids": ["not-an-int"]})
        self.assertEqual(bad_seen.status_code, 200)
        self.assertEqual(bad_seen.get_json()["updated"], 0)
        self.assertEqual(bad_seen.get_json()["unread_count"], 2)

        # Marking one specific notification read updates unread_count cleanly
        one_seen = self.client.post("/farmer/notifications/seen", json={"ids": [n1_id]})
        self.assertEqual(one_seen.status_code, 200)
        self.assertEqual(one_seen.get_json()["updated"], 1)
        self.assertEqual(one_seen.get_json()["unread_count"], 1)

        # /users/notifications/data reports consistent counts and serialized fields
        data_resp = self.client.get("/users/notifications/data")
        self.assertEqual(data_resp.status_code, 200)
        data_json = data_resp.get_json()
        self.assertTrue(data_json["ok"])
        self.assertEqual(data_json["total"], 2)
        self.assertEqual(data_json["unread_count"], 1)
        by_id = {item["id"]: item for item in data_json["items"]}
        self.assertTrue(by_id[n1_id]["is_read"])
        self.assertFalse(by_id[n2_id]["is_read"])

        # Mark remaining unread notification seen via /users/notifications/seen
        all_seen = self.client.post("/users/notifications/seen", json={})
        self.assertEqual(all_seen.status_code, 200)
        self.assertEqual(all_seen.get_json()["updated"], 1)
        self.assertEqual(all_seen.get_json()["unread_count"], 0)
        self.assertIsNotNone(db.session.get(Notification, n2_id).read_at)


if __name__ == "__main__":
    unittest.main()
