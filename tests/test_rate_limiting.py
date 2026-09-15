import unittest
from unittest.mock import patch
from flask import Flask
from app.utils.rate_limiting import register_rate_limiting
from app.utils.security_headers import register_security_headers


class RateLimitingTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True, RATELIMIT_STORAGE_URI='memory://',
            RATE_LIMIT_GLOBAL='20 per minute', RATE_LIMIT_AUTH='2 per minute',
            RATE_LIMIT_RECOVERY='1 per minute', RATE_LIMIT_EXPENSIVE='1 per minute',
        )
        self.executed = []
        def view():
            self.executed.append(True)
            return {'ok': True}
        for path, endpoint in [('/login', 'auth.login'), ('/api/login', 'api.login'),
                               ('/reset', 'api.api_reset_password'),
                               ('/reset-alias', 'auth.reset_password_api'),
                               ('/chat', 'farmer.chat'), ('/other', 'other'),
                               ('/healthz', 'healthz')]:
            def endpoint_view():
                return view()
            endpoint_view.__name__ = endpoint.replace('.', '_')
            self.app.add_url_rule(path, endpoint, endpoint_view, methods=['GET', 'POST'])
        register_security_headers(self.app)
        self.limiter = register_rate_limiting(self.app)
        self.client = self.app.test_client()

    def test_auth_budget_shared_between_web_and_api(self):
        self.assertEqual(self.client.post('/login').status_code, 200)
        self.assertEqual(self.client.post('/api/login').status_code, 200)
        response = self.client.post('/api/login')
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json['code'], 'rate_limit_exceeded')
        self.assertGreater(int(response.headers['Retry-After']), 0)
        self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(len(self.executed), 2)

    def test_clients_have_independent_budgets_and_forwarded_ip_is_not_trusted(self):
        for _ in range(2):
            self.client.post('/login')
        self.assertEqual(self.client.post('/login', headers={
            'X-Forwarded-For': '198.51.100.99', 'CF-Connecting-IP': '198.51.100.99'
        }).status_code, 429)
        self.assertEqual(self.client.post('/login', environ_overrides={
            'REMOTE_ADDR': '198.51.100.2'}).status_code, 200)

    def test_sensitive_gets_do_not_use_post_budget(self):
        for _ in range(3):
            self.assertEqual(self.client.get('/login').status_code, 200)
        self.assertEqual(self.client.post('/login').status_code, 200)
        self.assertEqual(self.client.post('/reset').status_code, 200)
        self.assertEqual(self.client.post('/reset-alias').status_code, 429)
        self.assertEqual(self.client.post('/chat').status_code, 200)
        self.assertEqual(self.client.post('/chat').status_code, 429)

    def test_global_budget_spans_paths_and_exempts_health_and_preflight(self):
        for _ in range(25):
            self.assertEqual(self.client.get('/healthz').status_code, 200)
            self.assertEqual(self.client.options('/other').status_code, 200)
        for i in range(20):
            self.assertEqual(self.client.get('/other' if i % 2 else '/login').status_code, 200)
        self.assertEqual(self.client.get('/other').status_code, 429)
        self.assertEqual(self.client.get('/healthz').status_code, 200)

    def test_storage_failure_does_not_execute_view(self):
        with patch.object(self.limiter.limiter, 'hit', side_effect=RuntimeError('Storage unavailable')):
            with self.assertRaises(RuntimeError):
                self.client.post('/login')
        self.assertEqual(self.executed, [])


if __name__ == '__main__':
    unittest.main()
