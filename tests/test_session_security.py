import time
import unittest
from unittest.mock import patch

from cachelib import SimpleCache
from flask import Flask, jsonify, session
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user

from app.config import Config
from app.utils.session_security import init_server_sessions, register_session_security


class Account(UserMixin):
    id = '1'
    password_hash = 'initial-password-hash'
    active = True

    def has_role(self, role):
        return False

    @property
    def is_active(self):
        return self.active


class SessionSecurityTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.from_object(Config)
        self.app.config.update(
            TESTING=True, SECRET_KEY='isolated-test-secret', SESSION_TYPE='cachelib',
            SESSION_CACHELIB=SimpleCache(), SESSION_COOKIE_SECURE=True,
            SESSION_COOKIE_SAMESITE='None', SESSION_IDLE_TIMEOUT_SECONDS=60,
            SESSION_ABSOLUTE_TIMEOUT_SECONDS=180,
        )
        manager = LoginManager(self.app)
        self.account = Account()
        manager.user_loader(lambda user_id: self.account if user_id == '1' else None)
        init_server_sessions(self.app)
        register_session_security(self.app)

        @self.app.get('/prepare')
        def prepare():
            session['verification_code'] = '123456'
            session['verify_user_id'] = 'old-flow'
            return {'ok': True}

        @self.app.post('/login')
        def login():
            login_user(self.account, remember=True)  # Even a forgotten legacy caller is bounded.
            return {'ok': True}

        @self.app.post('/logout')
        def logout():
            logout_user()
            return {'ok': True}

        @self.app.get('/api/private')
        @login_required
        def private():
            return jsonify(id=current_user.id)

        self.client = self.app.test_client()

    def request(self, path, method='GET', client=None):
        return (client or self.client).open(path, method=method, base_url='https://localhost')

    def login(self, client=None):
        return self.request('/login', 'POST', client)

    def test_login_rotates_id_clears_pre_auth_state_and_sets_cookie_flags(self):
        self.request('/prepare')
        before = self.client.get_cookie('session').value
        response = self.login()
        after = self.client.get_cookie('session').value
        self.assertNotEqual(before, after)
        self.assertNotIn('123456', after)
        cookie = next(c for c in response.headers.getlist('Set-Cookie') if c.startswith('session='))
        for flag in ('Secure', 'HttpOnly', 'SameSite=None', 'Path=/'):
            self.assertIn(flag, cookie)
        self.assertIsNone(self.client.get_cookie('remember_token'))
        with self.client.session_transaction() as stored:
            self.assertNotIn('verify_user_id', stored)
            self.assertNotIn('verification_code', stored)
        replay = self.app.test_client()
        replay.set_cookie('session', before)
        self.assertEqual(self.request('/api/private', client=replay).status_code, 401)

    def test_logout_revokes_copied_cookie(self):
        self.login()
        stolen = self.client.get_cookie('session').value
        self.request('/logout', 'POST')
        replay = self.app.test_client()
        replay.set_cookie('session', stolen)
        self.assertEqual(self.request('/api/private', client=replay).status_code, 401)

    def test_idle_timeout_and_absolute_timeout(self):
        start = time.time()
        with patch('app.utils.session_security.time.time', return_value=start):
            self.login()
        with patch('app.utils.session_security.time.time', return_value=start + 61):
            response = self.request('/api/private')
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json['code'], 'session_expired')
        with patch('app.utils.session_security.time.time', return_value=start):
            self.login()
        for elapsed in (50, 100, 150):
            with patch('app.utils.session_security.time.time', return_value=start + elapsed):
                self.assertEqual(self.request('/api/private').status_code, 200)
        with patch('app.utils.session_security.time.time', return_value=start + 181):
            self.assertEqual(self.request('/api/private').status_code, 401)

    def test_password_change_revokes_sessions_on_other_devices(self):
        other = self.app.test_client()
        self.login()
        self.login(other)
        self.account.password_hash = 'changed-password-hash'
        for client in (self.client, other):
            self.assertEqual(self.request('/api/private', client=client).status_code, 401)

    def test_banned_account_is_signed_out(self):
        self.login()
        self.account.active = False
        self.assertEqual(self.request('/api/private').status_code, 401)

    def test_old_remember_cookie_cannot_restore_authentication(self):
        from flask_login.utils import encode_cookie
        with self.app.app_context():
            cookie = encode_cookie('1')
        self.client.set_cookie('remember_token', cookie)
        self.assertEqual(self.request('/api/private').status_code, 401)
        self.assertIsNone(self.client.get_cookie('remember_token'))

    def test_authenticated_response_is_not_cacheable(self):
        self.login()
        response = self.request('/api/private')
        self.assertEqual(response.headers['Cache-Control'], 'no-store, private')


if __name__ == '__main__':
    unittest.main()
