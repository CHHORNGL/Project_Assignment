import unittest

from flask import Flask, redirect
from werkzeug.middleware.proxy_fix import ProxyFix

from app.utils.security_headers import register_security_headers


class SecurityHeaderTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1)
        register_security_headers(app)
        app.add_url_rule('/', endpoint='/', view_func=lambda: '<h1>Hello</h1>')
        app.add_url_rule('/api', endpoint='/api', view_func=lambda: {'ok': True})
        app.add_url_rule('/redirect', endpoint='/redirect', view_func=lambda: redirect('/'))
        app.add_url_rule('/error', endpoint='/error', view_func=lambda: ('Failure', 500))
        app.add_url_rule('/strict', endpoint='/strict', view_func=lambda: (
            '', 200, {'Content-Security-Policy': "default-src 'none'",
                      'X-Frame-Options': 'DENY'}))
        self.client = app.test_client()

    def test_headers_cover_html_json_redirects_and_errors(self):
        for path, status in [('/', 200), ('/api', 200), ('/redirect', 302),
                             ('/missing', 404), ('/error', 500)]:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.headers['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(response.headers['X-Frame-Options'], 'SAMEORIGIN')
                self.assertEqual(response.headers['Referrer-Policy'],
                                 'strict-origin-when-cross-origin')
                self.assertIn("frame-ancestors 'self'",
                              response.headers['Content-Security-Policy'])
                self.assertIn('camera=(self)', response.headers['Permissions-Policy'])
                self.assertEqual(response.headers['X-XSS-Protection'], '0')

    def test_hsts_only_for_https_including_proxy(self):
        self.assertNotIn('Strict-Transport-Security', self.client.get('/').headers)
        for kwargs in ({'base_url': 'https://example.test'},
                       {'headers': {'X-Forwarded-Proto': 'https'}}):
            response = self.client.get('/', **kwargs)
            self.assertEqual(response.headers['Strict-Transport-Security'],
                             'max-age=31536000')

    def test_explicit_endpoint_policy_is_preserved(self):
        response = self.client.get('/strict')
        self.assertEqual(response.headers['Content-Security-Policy'], "default-src 'none'")
        self.assertEqual(response.headers['X-Frame-Options'], 'DENY')


if __name__ == '__main__':
    unittest.main()
