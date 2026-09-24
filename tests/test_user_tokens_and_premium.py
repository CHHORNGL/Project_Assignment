import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from flask import Flask

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.models.user import User
from app.services.openai_assistant import (
    _uses_farmer_ai_credits,
    get_simple_user_daily_tokens,
    generate_assistant_reply,
)


class UserTokensAndPremiumTests(unittest.TestCase):
    def test_user_has_active_premium(self):
        user = User(username="test_simple", is_premium=False)
        self.assertFalse(user.has_active_premium)

        # Lifetime premium
        user_lifetime = User(username="test_pro", is_premium=True, premium_expires_at=None)
        self.assertTrue(user_lifetime.has_active_premium)

        # Future premium
        user_future = User(
            username="test_future",
            is_premium=True,
            premium_expires_at=datetime.utcnow() + timedelta(days=30),
        )
        self.assertTrue(user_future.has_active_premium)

        # Expired premium
        user_expired = User(
            username="test_expired",
            is_premium=True,
            premium_expires_at=datetime.utcnow() - timedelta(days=1),
        )
        self.assertFalse(user_expired.has_active_premium)
        self.assertFalse(user_expired.sync_premium_status())
        self.assertFalse(user_expired.is_premium)

    def test_uses_farmer_ai_credits_logic(self):
        # Anonymous user
        self.assertFalse(_uses_farmer_ai_credits(None))
        anon = MagicMock(is_authenticated=False)
        self.assertFalse(_uses_farmer_ai_credits(anon))

        # Standard simple farmer
        simple_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=False,
            is_premium=False,
            premium_expires_at=None,
        )
        simple_farmer.has_role.side_effect = lambda role: role == "farmer"
        simple_farmer.has_route_access.side_effect = lambda route: route == "farmer"
        self.assertTrue(_uses_farmer_ai_credits(simple_farmer))

        # Premium farmer (Unlimited)
        premium_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=True,
            is_premium=True,
            premium_expires_at=None,
        )
        premium_farmer.has_role.side_effect = lambda role: role == "farmer"
        premium_farmer.has_route_access.side_effect = lambda route: route == "farmer"
        self.assertFalse(_uses_farmer_ai_credits(premium_farmer))

        # Expired premium farmer (reverts to credit control)
        expired_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=False,
            is_premium=True,
            premium_expires_at=datetime.utcnow() - timedelta(days=2),
        )
        expired_farmer.has_role.side_effect = lambda role: role == "farmer"
        expired_farmer.has_route_access.side_effect = lambda route: route == "farmer"
        self.assertTrue(_uses_farmer_ai_credits(expired_farmer))

        # Admin (Unlimited)
        admin_user = MagicMock(
            is_authenticated=True,
            has_active_premium=False,
            is_premium=False,
            premium_expires_at=None,
        )
        admin_user.has_role.side_effect = lambda role: role == "admin"
        admin_user.has_route_access.side_effect = lambda route: True
        self.assertFalse(_uses_farmer_ai_credits(admin_user))

    def test_zero_credits_simple_user_blocked(self):
        simple_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=False,
            is_premium=False,
            ai_credits=0,
            last_credit_reset=datetime.utcnow(),
        )
        simple_farmer.has_role.side_effect = lambda role: role == "farmer"
        simple_farmer.has_route_access.side_effect = lambda route: route == "farmer"

        app = Flask(__name__)
        with app.app_context(), app.test_request_context():
            with patch("app.services.openai_assistant.current_user", simple_farmer):
                # Khmer prompt
                reply_km = generate_assistant_reply("សួស្តី តើដំណាំស្រូវកើតអី?")
                self.assertIn("សុំទោស! អ្នកបានអស់ចំនួន Token", reply_km)
                self.assertIn("Premium", reply_km)

                # English prompt
                reply_en = generate_assistant_reply("What disease affects rice?")
                self.assertIn("Sorry! You have run out of AI Credits", reply_en)
                self.assertIn("Premium", reply_en)

    def test_premium_user_with_zero_credits_never_blocked(self):
        premium_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=True,
            is_premium=True,
            premium_expires_at=None,
            ai_credits=0,
            last_credit_reset=datetime.utcnow(),
        )
        premium_farmer.has_role.side_effect = lambda role: role == "farmer"
        premium_farmer.has_route_access.side_effect = lambda route: route == "farmer"

        app = Flask(__name__)
        with app.app_context(), app.test_request_context():
            with patch("app.services.openai_assistant.current_user", premium_farmer):
                reply = generate_assistant_reply("តើអ្នកជានរណា?")
                # Premium user receives full assistant identity reply, not blocked
                self.assertIn("AGY V2.0.0", reply)
                self.assertIn("ម៉ៅ សៀវអ៊ិ", reply)
                # Verify credits remained 0 (not deducted into negative)
                self.assertEqual(premium_farmer.ai_credits, 0)

    def test_simple_user_tokens_deducted_on_chat(self):
        simple_farmer = MagicMock(
            is_authenticated=True,
            has_active_premium=False,
            is_premium=False,
            ai_credits=10000,
            last_credit_reset=datetime.utcnow(),
        )
        simple_farmer.has_role.side_effect = lambda role: role == "farmer"
        simple_farmer.has_route_access.side_effect = lambda route: route == "farmer"

        app = Flask(__name__)
        with app.app_context(), app.test_request_context():
            with patch("app.services.openai_assistant.current_user", simple_farmer):
                reply = generate_assistant_reply("តើអ្នកណាបង្កើតអ្នក?")
                self.assertIn("ម៉ៅ សៀវអ៊ិ", reply)
                self.assertLess(simple_farmer.ai_credits, 10000)

    def test_farmer_chat_route_returns_unlimited_for_premium(self):
        from app.blueprints.farmer import routes

        app = Flask(__name__)
        chat_dummy = lambda session_id=None: ""
        app.add_url_rule("/farmer/chat", endpoint="farmer.chat", defaults={"session_id": None}, view_func=chat_dummy)
        app.add_url_rule("/farmer/chat/<int:session_id>", endpoint="farmer.chat", view_func=chat_dummy)

        premium_user = MagicMock(
            id=42,
            has_active_premium=True,
            is_premium=True,
            ai_credits=0,
        )
        premium_user.has_route_access.return_value = True

        session = MagicMock(id=10, title="Rice Diagnosis")

        with patch.object(routes, "_ensure_legacy_session"), \
             patch.object(routes, "db"), \
             patch.object(routes, "notify_role"), \
             patch.object(routes, "ChatMessage"), \
             patch.object(routes, "current_user", premium_user):
            sessions_mock = patch.object(routes, "ChatSession").start()
            sessions_mock.query.filter_by.return_value.order_by.return_value.all.return_value = [session]
            sessions_mock.query.filter_by.return_value.first.return_value = session
            patch.object(routes, "Crop").start()
            patch.object(routes, "generate_assistant_reply", return_value="Here is your advice.").start()

            headers = {"X-Requested-With": "XMLHttpRequest"}
            with app.test_request_context("/farmer/chat/10", method="POST", data={"message": "Help with rice"}, headers=headers):
                response = app.make_response(routes.chat.__wrapped__(10))
                self.assertEqual(response.status_code, 200)
                data = response.json
                self.assertEqual(data["credits_remaining"], "unlimited")
                self.assertTrue(data["is_premium"])

            patch.stopall()

    def test_daily_tokens_setting_and_admin_update(self):
        from app.models.site_setting import SiteSetting
        from app.blueprints.admin import routes as admin_routes

        app = Flask(__name__)
        app.secret_key = "secret"
        app.add_url_rule("/admin/users", endpoint="admin.users", view_func=lambda: "")
        user_to_update = MagicMock(id=99, username="somchai", ai_credits=500)

        with patch.object(admin_routes, "User") as mock_user_cls, \
             patch.object(admin_routes, "db") as mock_db, \
             patch.object(admin_routes, "current_user", MagicMock(id=1, username="admin")), \
             patch.object(admin_routes, "AuditLog") as mock_audit:

            import inspect
            mock_user_cls.query.get_or_404.return_value = user_to_update
            fn = inspect.unwrap(admin_routes.update_user_credits)

            with app.test_request_context("/admin/users/99/update-credits", method="POST", data={"ai_credits": "25000"}):
                response = fn(99)
                self.assertEqual(user_to_update.ai_credits, 25000)
                mock_db.session.commit.assert_called_once()
                self.assertEqual(response.status_code, 302)

        # Test SiteSetting retrieval
        with app.app_context():
            with patch("app.models.site_setting.SiteSetting.query") as mock_query:
                mock_setting = MagicMock(value="20000")
                mock_query.get.return_value = mock_setting
                self.assertEqual(get_simple_user_daily_tokens(), 20000)

                mock_query.get.return_value = None
                self.assertEqual(get_simple_user_daily_tokens(), 13000)


if __name__ == "__main__":
    unittest.main()
