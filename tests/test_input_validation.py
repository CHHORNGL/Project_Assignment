import unittest
from unittest.mock import patch
from flask import Flask
from app import create_app
from app.config import Config
from app.utils.input_validation import (
    InputValidationError, register_input_validation, text_field, email_field,
    password_field, code_field, boolean_field, positive_integer, string_list,
    safe_next_url, support_message_fields,
)


class InputValidationTests(unittest.TestCase):
    def test_password_and_unicode_are_preserved(self):
        password = '  សួស្តី<script>🌾  '
        self.assertEqual(password_field({'password': password}, new=True), password)
        self.assertEqual(text_field({'name': ' សុខ O\'Brien '}, 'name'), "សុខ O'Brien")
        self.assertEqual(email_field({'email': ' User@EXAMPLE.com '}), 'user@example.com')

    def test_wrong_types_lengths_and_formats_are_rejected(self):
        cases = [
            lambda: text_field({'name': []}, 'name'),
            lambda: text_field({'name': 'x' * 51}, 'name', maximum=50),
            lambda: email_field({'email': 'not-an-email'}),
            lambda: password_field({'password': 'short'}, new=True),
            lambda: password_field({'password': 'x' * 1025}),
            lambda: code_field({'code': '12345x'}),
            lambda: boolean_field({'enabled': 'false'}, 'enabled'),
            lambda: positive_integer({'id': True}, 'id'),
            lambda: positive_integer({'id': -1}, 'id'),
            lambda: string_list({'symptoms': 'yellow leaves'}, 'symptoms'),
            lambda: string_list({'symptoms': ['yellow', {}]}, 'symptoms'),
        ]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(InputValidationError):
                case()
        self.assertFalse(boolean_field({'enabled': False}, 'enabled'))
        self.assertEqual(code_field({'code': '012345'}), '012345')

    def test_json_envelope_and_size(self):
        app = Flask(__name__)
        app.config['MAX_CONTENT_LENGTH'] = 1024
        register_input_validation(app)
        app.add_url_rule('/', view_func=lambda: {'ok': True}, methods=['POST'])
        client = app.test_client()
        for body in ('[]', 'null', '"text"', '123', '{broken'):
            with self.subTest(body=body):
                response = client.post('/', data=body, content_type='application/json')
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json['field'], 'body')
        self.assertEqual(client.post('/', json={'message': 'x'*2000}).status_code, 413)
        self.assertEqual(client.post('/', json={}).status_code, 200)

    def test_external_redirects_are_rejected(self):
        for value in ('//evil.example', '/\\evil.example', 'https://evil.example', '/\nevil', None):
            self.assertIsNone(safe_next_url(value))
        self.assertEqual(safe_next_url('/farmer?tab=history'), '/farmer?tab=history')

    def test_support_text_is_preserved_and_unsafe_urls_rejected(self):
        message = '<img src=x onerror=alert(1)>'
        self.assertEqual(support_message_fields({'message': message}), (message, None, None))
        for url, kind in [('javascript:alert(1)', 'image'), ('//evil.example/a.png', 'image'),
                          ('/static/uploads/chats/x" onerror="alert(1)', 'image'),
                          ('91,0', 'location'), ('NaN,0', 'location')]:
            with self.subTest(url=url), self.assertRaises(InputValidationError):
                support_message_fields({'message': '', 'attachment_url': url, 'attachment_type': kind})
        path = '/static/uploads/chats/' + 'a'*32 + '.webm'
        self.assertEqual(support_message_fields({'attachment_url': path, 'attachment_type': 'audio'}),
                         ('', path, 'audio'))


class RealRouteValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(Config, SQLALCHEMY_DATABASE_URI='sqlite://',
                            RATELIMIT_STORAGE_URI='memory://', RATE_LIMIT_AUTH='1000 per minute',
                            RATE_LIMIT_RECOVERY='1000 per minute'):
            cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_expired_reset_code_cannot_change_password(self):
        from datetime import datetime, timedelta
        from unittest.mock import MagicMock
        user = MagicMock()
        user.two_factor_code = '123456'
        user.two_factor_expiry = datetime.utcnow() - timedelta(minutes=1)
        with patch('app.blueprints.auth.routes.User') as model:
            model.query.filter_by.return_value.first.return_value = user
            response = self.client.post('/api/reset-password', json={
                'action': 'reset_password', 'email': 'user@example.com',
                'code': '123456', 'password': 'new password',
            })
        self.assertEqual(response.status_code, 400)
        user.set_password.assert_not_called()

    def test_missing_api_session_returns_401(self):
        response = self.client.post('/api/diagnose', json={'symptoms': ['yellow leaves']})
        self.assertEqual(response.status_code, 401)

    def test_invalid_auth_inputs_return_400_before_database_access(self):
        # No schema is created: database access here would cause a failure.
        cases = [
            ('/api/login', {'username': {}, 'password': 'secret'}),
            ('/api/login', {'email': 'user@example.com', 'password': []}),
            ('/api/register', {'email': 'invalid', 'password': 'secret'}),
            ('/api/register', {'email': 'user@example.com', 'password': 'x'}),
            ('/api/verify-code', {'code': 123456}),
            ('/auth/send-register-otp', {'email': []}),
            ('/auth/reset-password-api', {'action': 'reset_password', 'email': 'user@example.com',
                                          'code': '123456', 'password': 'x'}),
            ('/api/reset-password', {'action': 'unexpected'}),
            ('/api/google-login', {'id_token': []}),
        ]
        for path, data in cases:
            with self.subTest(path=path, data=data):
                response = self.client.post(path, json=data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json['code'], 'invalid_input')


if __name__ == '__main__':
    unittest.main()
