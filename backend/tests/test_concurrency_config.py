import importlib
import os
import pathlib as _pathlib
import sys as _sys
import threading
import unittest
from unittest.mock import patch

import yaml

for _p in (
    str(_pathlib.Path(__file__).resolve().parents[1]),
    str(_pathlib.Path(__file__).resolve().parents[2]),
):
    if _p not in _sys.path:
        _sys.path.insert(0, _p)

REPO_ROOT = _pathlib.Path(__file__).resolve().parents[2]


class ConcurrencyConfigTests(unittest.TestCase):
    def test_gunicorn_defaults_to_gthread_with_six_threads(self):
        gunicorn_conf_path = REPO_ROOT / "backend" / "gunicorn.conf.py"
        spec = importlib.util.spec_from_file_location("gunicorn_conf_test", gunicorn_conf_path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GUNICORN_WORKER_CLASS", None)
            os.environ.pop("GUNICORN_THREADS", None)
            os.environ.pop("WEB_CONCURRENCY", None)
            spec.loader.exec_module(module)

        self.assertEqual(module.worker_class, "gthread")
        self.assertEqual(module.workers, 2)
        self.assertEqual(module.threads, 6)
        self.assertGreaterEqual(module.timeout, 180)

    def test_entrypoint_and_render_blueprint_enable_gthread(self):
        entrypoint = (REPO_ROOT / "backend" / "entrypoint.sh").read_text(encoding="utf-8")
        self.assertIn("--worker-class", entrypoint)
        self.assertIn("GUNICORN_WORKER_CLASS:-gthread", entrypoint)
        self.assertIn("--threads", entrypoint)
        self.assertIn("GUNICORN_THREADS:-6", entrypoint)

        blueprint = yaml.safe_load((REPO_ROOT / "render.yaml").read_text(encoding="utf-8"))
        web = next(svc for svc in blueprint["services"] if svc["name"] == "agrisense-backend")
        env_by_key = {entry["key"]: entry for entry in web["envVars"]}
        self.assertEqual(env_by_key["GUNICORN_WORKER_CLASS"]["value"], "gthread")
        self.assertEqual(env_by_key["GUNICORN_THREADS"]["value"], "6")
        self.assertEqual(env_by_key["WEB_CONCURRENCY"]["value"], "2")

    def test_shared_caches_have_thread_locks(self):
        from app.blueprints.admin import routes as admin_routes
        from app.blueprints.farmer import routes as farmer_routes
        from app.services import login_activity, openai_assistant

        self.assertIsInstance(farmer_routes._TTS_CACHE_LOCK, type(threading.Lock()))
        self.assertIsInstance(login_activity._ACTIVITY_CACHE_LOCK, type(threading.Lock()))
        self.assertIsInstance(admin_routes._TRANSLATION_RATE_LIMIT_LOCK, type(threading.Lock()))
        self.assertIsInstance(openai_assistant._NEWS_CACHE_LOCK, type(threading.Lock()))


if __name__ == "__main__":
    unittest.main()
