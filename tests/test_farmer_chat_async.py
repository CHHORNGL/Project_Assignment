import unittest
from contextlib import ExitStack
from unittest.mock import MagicMock, patch
from flask import Flask
from app.blueprints.farmer import routes


class AsyncChatTests(unittest.TestCase):
    def call_chat(self, message, ajax=True):
        app = Flask(__name__)
        app.add_url_rule('/farmer/chat/<int:session_id>', endpoint='farmer.chat', view_func=lambda session_id: '')
        session = MagicMock(id=7, title='New Chat')
        with ExitStack() as stack:
            for name in ('_ensure_legacy_session', 'db', 'notify_role', 'ChatMessage'):
                stack.enter_context(patch.object(routes, name))
            stack.enter_context(patch.object(routes, 'current_user', MagicMock(id=1)))
            sessions = stack.enter_context(patch.object(routes, 'ChatSession'))
            sessions.query.filter_by.return_value.order_by.return_value.all.return_value = [session]
            sessions.query.filter_by.return_value.first.return_value = session
            crops = stack.enter_context(patch.object(routes, 'Crop'))
            crops.query.order_by.return_value.all.return_value = []
            generate = stack.enter_context(patch.object(routes, 'generate_assistant_reply', return_value='AI reply'))
            headers = {'X-Requested-With': 'XMLHttpRequest'} if ajax else {}
            with app.test_request_context('/farmer/chat/7', method='POST', data={'message': message}, headers=headers):
                response = app.make_response(routes.chat.__wrapped__(7))
                return response, generate.call_count

    def test_ajax_returns_reply_without_redirect(self):
        response, calls = self.call_chat('How do I care for rice?')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['reply'], 'AI reply')
        self.assertEqual(response.json['session_id'], 7)
        self.assertEqual(calls, 1)

    def test_empty_ajax_message_is_rejected(self):
        response, calls = self.call_chat('  ')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json['ok'])
        self.assertEqual(calls, 0)

    def test_regular_form_retains_redirect_fallback(self):
        response, _ = self.call_chat('Rice question', ajax=False)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.location, '/farmer/chat/7')
