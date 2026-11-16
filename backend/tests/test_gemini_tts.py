# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import base64
import json
import os
import re
import tempfile
import unittest
from unittest.mock import Mock, patch

_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app import create_app
from app.blueprints.farmer.routes import _TTS_CACHE
from app.config import Config
from app.extensions import db
from app.models.role import Role
from app.models.user import User
from app.services.gemini_tts_service import (
    GEMINI_INTERACTIONS_URL,
    GEMINI_TTS_MODEL,
    decrypt_user_api_key,
    encrypt_user_api_key,
    mask_api_key,
    synthesize_gemini_tts,
    validate_gemini_api_key_format,
)


class GeminiTtsOption1TestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
            RATE_LIMIT_AUTH="1000 per minute;10000 per hour",
            RATE_LIMIT_GLOBAL="10000 per minute;100000 per hour",
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
        _TTS_CACHE.clear()
        self.app_ctx = self.app.app_context()
        self.app_ctx.push()
        db.create_all()

        role = Role.query.filter_by(name="farmer").first()
        if not role:
            role = Role(name="farmer", route_type="farmer")
            db.session.add(role)
            db.session.flush()

        self.farmer = User(
            username="gemini_farmer",
            email="gemini_farmer@example.com",
            full_name="Gemini Farmer",
            is_active=True,
            is_verified=True,
        )
        self.farmer.set_password("Password123!")
        self.farmer.roles.append(role)

        self.other_farmer = User(
            username="plain_farmer",
            email="plain_farmer@example.com",
            full_name="Plain Farmer",
            is_active=True,
            is_verified=True,
            google_sub="google-sub-taken-999",
        )
        self.other_farmer.set_password("Password123!")
        self.other_farmer.roles.append(role)

        db.session.add_all([self.farmer, self.other_farmer])
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_ctx.pop()

    def _login(self, email="gemini_farmer@example.com"):
        return self.client.post(
            "/auth/login",
            data={"email": email, "password": "Password123!"},
            follow_redirects=False,
        )

    def test_key_validation_encryption_and_masking(self):
        sample_key = "AIzaSyTestFarmerPersonalKey1234567890ABCD"
        ok, err = validate_gemini_api_key_format(sample_key)
        self.assertTrue(ok)
        self.assertIsNone(err)

        bad_cases = ["", "   ", "sk-proj-wrong-provider", "AIza short space", "AIzaTooShort"]
        for bad in bad_cases:
            ok_bad, msg_bad = validate_gemini_api_key_format(bad)
            self.assertFalse(ok_bad, f"Expected rejection for {bad!r}")
            self.assertTrue(bool(msg_bad))

        encrypted = encrypt_user_api_key(sample_key)
        self.assertTrue(encrypted.startswith("enc:v1:"))
        self.assertLessEqual(len(encrypted), 255)
        self.assertNotIn(sample_key, encrypted)

        self.assertEqual(decrypt_user_api_key(encrypted), sample_key)
        self.assertEqual(decrypt_user_api_key("enc:v1:corrupted-token"), None)

        masked = mask_api_key(encrypted)
        self.assertEqual(masked, "AIzaSy••••••••ABCD")

    def test_synthesize_gemini_tts_uses_interactions_api(self):
        fake_wav = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 16
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "steps": [
                {
                    "type": "model_output",
                    "content": [
                        {
                            "type": "audio",
                            "data": base64.b64encode(fake_wav).decode("ascii"),
                            "mime_type": "audio/wav",
                        }
                    ],
                }
            ]
        }

        with patch("app.services.gemini_tts_service.requests.post", return_value=mock_resp) as post_mock:
            result = synthesize_gemini_tts(
                "សួស្តីកសិករ",
                api_key="AIzaSyFarmerKey1234567890ABCDEF",
                lang="km",
            )

        self.assertEqual(result, (fake_wav, "audio/wav"))
        post_mock.assert_called_once()
        self.assertEqual(post_mock.call_args.args[0], GEMINI_INTERACTIONS_URL)
        self.assertEqual(post_mock.call_args.kwargs["headers"]["x-goog-api-key"], "AIzaSyFarmerKey1234567890ABCDEF")
        self.assertEqual(post_mock.call_args.kwargs["headers"]["Api-Revision"], "2026-05-20")
        sent_json = post_mock.call_args.kwargs["json"]
        self.assertEqual(sent_json["model"], GEMINI_TTS_MODEL)
        self.assertEqual(sent_json["response_format"], {"type": "audio"})
        self.assertEqual(sent_json["generation_config"]["speech_config"][0]["voice"], "Kore")
        self.assertEqual(sent_json["input"][0]["content"][0]["text"], "សួស្តីកសិករ")
        self.assertEqual(sent_json["input"][0]["content"][0]["annotations"][0]["type"], "speech_metadata")

        err_resp = Mock()
        err_resp.status_code = 403
        with patch("app.services.gemini_tts_service.requests.post", return_value=err_resp):
            self.assertIsNone(synthesize_gemini_tts("Hello", api_key="AIzaSyFarmerKey1234567890ABCDEF", lang="en"))

    def test_settings_save_preserve_clear_and_no_raw_key_leak(self):
        self._login()
        raw_key = "AIzaSyMyPersonalStudioKey9876543210ZYXW"

        res = self.client.post(
            "/users/settings",
            data={"theme": "dark", "gemini_api_key": raw_key},
            follow_redirects=False,
        )
        self.assertEqual(res.status_code, 302)

        refreshed = User.query.filter_by(email="gemini_farmer@example.com").first()
        self.assertEqual(refreshed.ai_model, "own-ai")
        self.assertIsNotNone(refreshed.ai_api_key)
        self.assertTrue(refreshed.ai_api_key.startswith("enc:v1:"))
        self.assertNotIn(raw_key, refreshed.ai_api_key)
        self.assertEqual(decrypt_user_api_key(refreshed.ai_api_key), raw_key)

        # Updating theme alone preserves saved Gemini key
        res_theme = self.client.post(
            "/users/settings",
            data={"theme": "light", "gemini_api_key": ""},
            follow_redirects=False,
        )
        self.assertEqual(res_theme.status_code, 302)
        refreshed = User.query.filter_by(email="gemini_farmer@example.com").first()
        self.assertEqual(decrypt_user_api_key(refreshed.ai_api_key), raw_key)

        # Settings page bootstrap exposes masked preview only, never raw key
        page_res = self.client.get("/users/settings")
        self.assertEqual(page_res.status_code, 200)
        html = page_res.get_data(as_text=True)
        self.assertNotIn(raw_key, html)
        bootstrap_match = re.search(
            r'<script id="app-bootstrap" type="application/json">(.*?)</script>',
            html,
        )
        self.assertIsNotNone(bootstrap_match)
        payload = json.loads(bootstrap_match.group(1))
        self.assertTrue(payload["data"]["geminiTtsConfigured"])
        self.assertEqual(payload["data"]["geminiTtsKeyMasked"], "AIzaSy••••••••ZYXW")
        self.assertEqual(payload["data"]["geminiTtsModel"], "gemini-3.8-flash-tts")

        # /api/me must not leak raw or encrypted ai_api_key
        me_res = self.client.get("/api/me")
        self.assertEqual(me_res.status_code, 200)
        me_json = json.loads(me_res.get_data(as_text=True))
        self.assertIsNone(me_json["ai_api_key"])

        # Invalid key format is rejected without wiping existing key
        bad_res = self.client.post(
            "/users/settings",
            data={"theme": "light", "gemini_api_key": "sk-not-a-gemini-key"},
            follow_redirects=False,
        )
        self.assertEqual(bad_res.status_code, 302)
        refreshed = User.query.filter_by(email="gemini_farmer@example.com").first()
        self.assertEqual(decrypt_user_api_key(refreshed.ai_api_key), raw_key)

        # Clearing key removes it cleanly
        clear_res = self.client.post(
            "/users/settings",
            data={"theme": "light", "clear_gemini_api_key": "y"},
            follow_redirects=False,
        )
        self.assertEqual(clear_res.status_code, 302)
        refreshed = User.query.filter_by(email="gemini_farmer@example.com").first()
        self.assertIsNone(refreshed.ai_api_key)

    def test_farmer_tts_routes_to_personal_gemini_and_isolates_cache(self):
        raw_key = "AIzaSyPersonalListenKey1234567890QWER"
        self.farmer.ai_api_key = encrypt_user_api_key(raw_key)
        db.session.commit()

        self._login("gemini_farmer@example.com")

        gemini_wav = b"RIFF\x20\x00\x00\x00WAVEgemini-voice-bytes"
        std_mp3 = b"ID3-standard-fallback-bytes"
        mock_std = Mock()
        mock_std.status_code = 200
        mock_std.content = std_mp3

        with (
            patch("app.services.gemini_tts_service.synthesize_gemini_tts", return_value=(gemini_wav, "audio/wav")) as gem_mock,
            patch("app.services.khmer_tts_service.synthesize_khmer_speech", return_value=None),
            patch("app.blueprints.farmer.routes.requests.get", return_value=mock_std) as std_get_mock,
        ):
            res = self.client.get("/farmer/api/tts?lang=en&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.mimetype, "audio/wav")
            self.assertEqual(res.data, gemini_wav)
            gem_mock.assert_called_once()
            self.assertEqual(gem_mock.call_args.kwargs["api_key"], raw_key)
            self.assertEqual(gem_mock.call_args.kwargs["lang"], "km")
            std_get_mock.assert_not_called()

            # HTTP Range request hits cache cleanly
            range_res = self.client.get(
                "/farmer/api/tts?lang=en&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8",
                headers={"Range": "bytes=0-3"},
            )
            self.assertEqual(range_res.status_code, 206)
            self.assertEqual(range_res.data, b"RIFF")

        # Keyless farmer MUST NOT get cached Gemini WAV for the same text
        self.client.get("/auth/logout")
        self._login("plain_farmer@example.com")
        with (
            patch("app.services.khmer_tts_service.synthesize_khmer_speech", return_value=None),
            patch("app.blueprints.farmer.routes.requests.get", return_value=mock_std) as std_get_mock,
        ):
            plain_res = self.client.get("/farmer/api/tts?lang=km&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8")
            self.assertEqual(plain_res.status_code, 200)
            self.assertEqual(plain_res.mimetype, "audio/mpeg")
            self.assertEqual(plain_res.data, std_mp3)
            std_get_mock.assert_called_once()

        # When farmer's Gemini call fails, fall back cleanly to standard TTS
        self.client.get("/auth/logout")
        self._login("gemini_farmer@example.com")
        _TTS_CACHE.clear()
        with (
            patch("app.services.gemini_tts_service.synthesize_gemini_tts", return_value=None),
            patch("app.services.khmer_tts_service.synthesize_khmer_speech", return_value=None),
            patch("app.blueprints.farmer.routes.requests.get", return_value=mock_std),
        ):
            fallback_res = self.client.get("/farmer/api/tts?lang=km&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8")
            self.assertEqual(fallback_res.status_code, 200)
            self.assertEqual(fallback_res.mimetype, "audio/mpeg")
            self.assertEqual(fallback_res.data, std_mp3)

    def test_google_link_and_disconnect_flow(self):
        self._login("gemini_farmer@example.com")

        fake_google = Mock()
        fake_google.authorize_redirect.return_value = self.app.response_class(
            status=302,
            headers={"Location": "https://accounts.google.com/o/oauth2/auth"},
        )

        with patch("app.blueprints.auth.routes._get_google_client", return_value=fake_google):
            link_res = self.client.get("/auth/google?link=1", follow_redirects=False)
            self.assertEqual(link_res.status_code, 302)
            with self.client.session_transaction() as sess:
                self.assertEqual(sess.get("google_link_user_id"), self.farmer.id)

            # Attempting to link a google_sub owned by another account is blocked
            fake_google.authorize_access_token.return_value = {"access_token": "tok"}
            fake_google.parse_id_token.return_value = {
                "sub": "google-sub-taken-999",
                "email": "someone_else@gmail.com",
            }
            conflict_res = self.client.get("/auth/google/callback", follow_redirects=False)
            self.assertEqual(conflict_res.status_code, 302)
            self.assertIn("/users/settings", conflict_res.headers.get("Location", ""))
            refreshed = User.query.filter_by(id=self.farmer.id).first()
            self.assertIsNone(refreshed.google_sub)

            # Restart link flow and connect new unique Google sub
            self.client.get("/auth/google?link=1", follow_redirects=False)
            fake_google.parse_id_token.return_value = {
                "sub": "google-sub-farmer-123",
                "email": "mygoogle@gmail.com",
                "name": "Farmer Google",
            }
            ok_res = self.client.get("/auth/google/callback", follow_redirects=False)
            self.assertEqual(ok_res.status_code, 302)
            self.assertIn("/users/settings", ok_res.headers.get("Location", ""))
            refreshed = User.query.filter_by(id=self.farmer.id).first()
            self.assertEqual(refreshed.google_sub, "google-sub-farmer-123")
            # Email should remain the user's account email, not overwritten
            self.assertEqual(refreshed.email, "gemini_farmer@example.com")

        # Settings page bootstrap now reports googleConnected = true
        settings_res = self.client.get("/users/settings")
        self.assertEqual(settings_res.status_code, 200)
        bootstrap_match = re.search(
            r'<script id="app-bootstrap" type="application/json">(.*?)</script>',
            settings_res.get_data(as_text=True),
        )
        if bootstrap_match:
            payload = json.loads(bootstrap_match.group(1))
            self.assertTrue(payload["data"]["googleConnected"])

        # Disconnect clears google_sub
        disc_res = self.client.post("/auth/google/disconnect", follow_redirects=False)
        self.assertEqual(disc_res.status_code, 302)
        refreshed = User.query.filter_by(id=self.farmer.id).first()
        self.assertIsNone(refreshed.google_sub)
