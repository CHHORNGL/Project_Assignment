# ruff: noqa: E402, I001
import json
import os
import pathlib as _pathlib
import sys as _sys
import tempfile
import unittest
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


class PwaRoutesTests(unittest.TestCase):
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
        cls.app.config.update({"TESTING": True, "WTF_CSRF_ENABLED": False})

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

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_manifest_webmanifest_served_with_valid_json(self):
        with self.client.get("/manifest.webmanifest") as resp:
            self.assertEqual(resp.status_code, 200)
            self.assertIn("manifest+json", resp.content_type)
            payload = json.loads(resp.get_data(as_text=True))
        self.assertEqual(payload["start_url"], "/")
        self.assertEqual(payload["display"], "standalone")
        self.assertTrue(len(payload["icons"]) >= 3)

    def test_service_worker_served_from_origin_root(self):
        with self.client.get("/sw.js") as resp:
            self.assertEqual(resp.status_code, 200)
            self.assertIn("javascript", resp.content_type)
            self.assertIn("no-store", resp.headers.get("Cache-Control", ""))

    def test_guest_landing_contains_pwa_manifest_and_viewport_cover(self):
        with self.client.get("/", follow_redirects=True) as resp:
            self.assertEqual(resp.status_code, 200)
            html = resp.get_data(as_text=True)
        self.assertIn('rel="manifest" href="/manifest.webmanifest"', html)
        self.assertIn("viewport-fit=cover", html)
        self.assertIn('name="apple-mobile-web-app-capable" content="yes"', html)


if __name__ == "__main__":
    unittest.main()
