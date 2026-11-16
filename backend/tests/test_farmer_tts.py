# ruff: noqa: E402, I001
import pathlib as _pathlib
import sys as _sys

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

import os
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


class FarmerTtsTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.multiple(
            Config,
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{_test_db_path}",
            SECRET_KEY=os.environ.get("SECRET_KEY", "test-secret-key-for-ci"),
        ):
            cls.app = create_app()
        cls.app.config.update({"TESTING": True})

    @classmethod
    def tearDownClass(cls):
        try:
            os.close(_test_db_fd)
            os.unlink(_test_db_path)
        except OSError:
            pass

    def setUp(self):
        _TTS_CACHE.clear()
        with self.app.app_context():
            db.create_all()
        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_tts_rejects_empty_text(self):
        res = self.client.get("/farmer/api/tts?lang=en&text=%20%2A%2A%20")
        self.assertEqual(res.status_code, 400)

    def test_tts_uses_external_khmer_api_with_key_when_configured(self):
        fake_wav = b"RIFF" + b"\x00\x10\x20\x30" * 30
        mock_api_resp = Mock(
            status_code=200,
            content=fake_wav,
            headers={"Content-Type": "audio/wav"},
        )
        with (
            patch.dict(
                os.environ,
                {
                    "KHMER_TTS_API_URL": "https://tts.example.com/synthesize",
                    "KHMER_TTS_API_KEY": "test-tts-key",
                },
                clear=False,
            ),
            patch("app.services.khmer_tts_service.requests.post", return_value=mock_api_resp) as post_mock,
            patch("app.blueprints.farmer.routes.requests.get") as google_mock,
        ):
            res_full = self.client.get(
                "/farmer/api/tts?lang=en&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8%20%E1%9E%80%E1%9E%9F%E1%9E%B7%E1%9E%80%E1%9E%9A"
            )
            self.assertEqual(res_full.status_code, 200)
            self.assertEqual(res_full.mimetype, "audio/wav")
            self.assertEqual(res_full.data, fake_wav)
            post_mock.assert_called_once()
            self.assertEqual(post_mock.call_args.kwargs["headers"]["Authorization"], "Bearer test-tts-key")
            google_mock.assert_not_called()

            res_range = self.client.get(
                "/farmer/api/tts?lang=en&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8%20%E1%9E%80%E1%9E%9F%E1%9E%B7%E1%9E%80%E1%9E%9A",
                headers={"Range": "bytes=0-3"},
            )
            self.assertEqual(res_range.status_code, 206)
            self.assertEqual(res_range.data, b"RIFF")

    def test_tts_detects_khmer_script_under_english_lang_and_supports_range_fallback(self):
        fake_mp3 = b"\xff\xf3\x84\xc4" + b"\x11\x22\x33\x44" * 64
        mock_resp = Mock(status_code=200, content=fake_mp3)

        with (
            patch("app.services.khmer_tts_service.synthesize_khmer_speech", return_value=None),
            patch("app.blueprints.farmer.routes.requests.get", return_value=mock_resp) as get_mock,
        ):
            res_full = self.client.get(
                "/farmer/api/tts?lang=en&text=%2A%2A%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8%2A%2A%20%E1%9E%80%E1%9E%9F%E1%9E%B7%E1%9E%80%E1%9E%9A"
            )
            self.assertEqual(res_full.status_code, 200)
            self.assertEqual(res_full.mimetype, "audio/mpeg")
            self.assertEqual(res_full.data, fake_mp3)
            called_url = get_mock.call_args.args[0]
            self.assertIn("tl=km", called_url)
            self.assertNotIn("%2A%2A", called_url)

            res_range = self.client.get(
                "/farmer/api/tts?lang=en&text=%E1%9E%9F%E1%9E%BD%E1%9E%9F%E1%9F%92%E1%9E%8F%E1%9E%B8%20%E1%9E%80%E1%9E%9F%E1%9E%B7%E1%9E%80%E1%9E%9A",
                headers={"Range": "bytes=0-1"},
            )
            self.assertEqual(res_range.status_code, 206)
            self.assertEqual(res_range.data, fake_mp3[:2])


if __name__ == "__main__":
    unittest.main()
