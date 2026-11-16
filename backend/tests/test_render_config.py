import importlib
import os
import pathlib as _pathlib
import sys as _sys
import unittest
from unittest.mock import patch

import yaml
from flask import Flask, request

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import app.config as app_config
from app.services.passkey_service import get_webauthn_rp_and_origins
from app.utils.security_headers import register_security_headers
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

REPO_ROOT = _pathlib.Path(__file__).resolve().parents[2]


class RenderConfigAndSecurityTests(unittest.TestCase):
    def test_render_blueprint_spec_and_secret_hygiene(self):
        blueprint_path = REPO_ROOT / "render.yaml"
        migration_doc = REPO_ROOT / "docs" / "render_migration.md"
        self.assertTrue(blueprint_path.exists())
        self.assertTrue(migration_doc.exists())

        parsed = yaml.safe_load(blueprint_path.read_text(encoding="utf-8"))
        services = {svc["name"]: svc for svc in parsed["services"]}
        self.assertIn("agrisense-kv", services)
        self.assertIn("agrisense-backend", services)

        kv = services["agrisense-kv"]
        self.assertEqual(kv["type"], "keyvalue")
        self.assertEqual(kv["region"], "singapore")
        self.assertEqual(kv["plan"], "starter")
        self.assertEqual(kv["ipAllowList"], [])

        web = services["agrisense-backend"]
        self.assertEqual(web["type"], "web")
        self.assertEqual(web["runtime"], "docker")
        self.assertEqual(web["dockerfilePath"], "./Dockerfile")
        self.assertEqual(web["region"], "singapore")
        self.assertEqual(web["plan"], "starter")
        self.assertEqual(web["healthCheckPath"], "/healthz")
        self.assertEqual(web["disk"]["mountPath"], "/app/app/static/uploads")
        self.assertGreaterEqual(web["disk"]["sizeGB"], 1)

        env_by_key = {entry["key"]: entry for entry in web["envVars"]}
        self.assertEqual(env_by_key["FLASK_ENV"]["value"], "production")
        self.assertEqual(env_by_key["TRUSTED_PROXY_COUNT"]["value"], "2")
        self.assertEqual(env_by_key["SESSION_TYPE"]["value"], "redis")
        self.assertEqual(env_by_key["SESSION_COOKIE_SECURE"]["value"], "true")
        self.assertEqual(env_by_key["SESSION_COOKIE_SAMESITE"]["value"], "Lax")
        self.assertEqual(
            env_by_key["REDIS_URL"]["fromService"],
            {
                "type": "keyvalue",
                "name": "agrisense-kv",
                "property": "connectionString",
            },
        )

        # Sensitive credentials must never be hardcoded in git.
        for secret_key in (
            "DATABASE_URL",
            "DATABASE_URL_UNPOOLED",
            "HF_TOKEN",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "BREVO_API_KEY",
            "PAYPAL_SECRET",
            "BAKONG_TOKEN",
            "ADMIN_PASSWORD",
        ):
            self.assertTrue(env_by_key[secret_key]["sync"] is False or "value" not in env_by_key[secret_key])
            self.assertNotIn("value", env_by_key[secret_key])

    def test_render_environment_detection_and_redis_fallback(self):
        env_overrides = {
            "RENDER": "true",
            "RENDER_EXTERNAL_HOSTNAME": "agrisense-backend.onrender.com",
            "RENDER_EXTERNAL_URL": "https://agrisense-backend.onrender.com",
            "REDIS_URL": "redis://red-123456:6379",
            "SESSION_REDIS_URL": "",
            "RATELIMIT_STORAGE_URI": "",
            "WEATHER_REDIS_URL": "",
            "SESSION_TYPE": "",
            "TRUSTED_PROXY_COUNT": "",
            "TRUSTED_PROTO_PROXY_COUNT": "",
            "SESSION_COOKIE_SAMESITE": "",
            "FLASK_ENV": "production",
            "APP_DOMAIN": "agricultureexp.com",
            "CORS_ALLOWED_ORIGINS": "",
        }
        try:
            with patch.dict(os.environ, env_overrides, clear=False):
                reloaded = importlib.reload(app_config)
                self.assertTrue(reloaded.is_render_environment())
                self.assertEqual(reloaded.Config.SESSION_TYPE, "redis")
                self.assertEqual(reloaded.Config.SESSION_REDIS_URL, "redis://red-123456:6379")
                self.assertEqual(reloaded.Config.RATELIMIT_STORAGE_URI, "redis://red-123456:6379")
                self.assertEqual(reloaded.Config.WEATHER_REDIS_URL, "redis://red-123456:6379")
                self.assertEqual(reloaded.Config.TRUSTED_PROXY_COUNT, 1)
                self.assertEqual(reloaded.Config.TRUSTED_PROTO_PROXY_COUNT, 1)
                self.assertEqual(reloaded.Config.SESSION_COOKIE_SAMESITE, "Lax")
                self.assertEqual(
                    reloaded.Config.CORS_ALLOWED_ORIGINS,
                    [
                        "https://agricultureexp.com",
                        "https://www.agricultureexp.com",
                        "https://agrisense-backend.onrender.com",
                    ],
                )
        finally:
            importlib.reload(app_config)

    def test_cors_blocks_untrusted_origins_when_allowlist_configured(self):
        with patch.dict(
            os.environ,
            {
                "RENDER": "true",
                "FLASK_ENV": "production",
                "APP_DOMAIN": "agricultureexp.com",
                "RENDER_EXTERNAL_URL": "https://agrisense-backend.onrender.com",
                "CORS_ALLOWED_ORIGINS": "",
            },
            clear=False,
        ):
            origins = app_config.get_cors_allowed_origins()

        app = Flask(__name__)
        CORS(app, origins=origins, supports_credentials=True)

        @app.get("/api/ping")
        def ping():
            return {"ok": True}

        client = app.test_client()
        allowed = client.get("/api/ping", headers={"Origin": "https://www.agricultureexp.com"})
        self.assertEqual(allowed.headers.get("Access-Control-Allow-Origin"), "https://www.agricultureexp.com")

        render_origin = client.get("/api/ping", headers={"Origin": "https://agrisense-backend.onrender.com"})
        self.assertEqual(
            render_origin.headers.get("Access-Control-Allow-Origin"),
            "https://agrisense-backend.onrender.com",
        )

        evil = client.get("/api/ping", headers={"Origin": "https://attacker.example"})
        self.assertIsNone(evil.headers.get("Access-Control-Allow-Origin"))

    def test_cloudflare_plus_render_proxy_fix_preserves_ip_and_https(self):
        app = Flask(__name__)
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2, x_proto=1, x_host=1, x_prefix=1)
        register_security_headers(app)

        @app.get("/whoami")
        def whoami():
            return {"ip": request.remote_addr, "secure": request.is_secure, "scheme": request.scheme}

        client = app.test_client()
        resp = client.get(
            "/whoami",
            headers={
                "X-Forwarded-For": "203.0.113.45, 172.70.98.10",
                "X-Forwarded-Proto": "https",
                "Host": "www.agricultureexp.com",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json(), {"ip": "203.0.113.45", "secure": True, "scheme": "https"})
        self.assertIn("max-age=", resp.headers.get("Strict-Transport-Security", ""))

    def test_webauthn_origin_reflection_rejects_mismatched_hosts(self):
        app = Flask(__name__)
        with app.test_request_context(
            "/",
            headers={
                "Host": "agrisense-backend.onrender.com",
                "Origin": "https://evil-phisher.example",
                "Referer": "https://evil-phisher.example/login",
            },
        ):
            rp_id, origins = get_webauthn_rp_and_origins(request)
            self.assertEqual(rp_id, "agrisense-backend.onrender.com")
            self.assertIn("https://agrisense-backend.onrender.com", origins)
            self.assertNotIn("https://evil-phisher.example", origins)


if __name__ == "__main__":
    unittest.main()
