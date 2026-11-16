# ruff: noqa: I001
import os
import pathlib as _pathlib
import shutil
import subprocess
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

from app import create_app
from app.config import (
    Config,
    build_sqlalchemy_engine_options,
    get_unpooled_database_url,
    normalize_database_url,
)
from scripts.wait_for_database import wait_for_database


REPO_ROOT = _pathlib.Path(__file__).resolve().parents[2]


class NeonAndDigitalOceanConfigTests(unittest.TestCase):
    def test_normalize_database_url_handles_schemes_and_neon_ssl(self):
        self.assertIsNone(normalize_database_url(""))
        self.assertIsNone(normalize_database_url(None))

        neon_legacy = "postgres://user:pass@ep-cool-pooler.ap-southeast-1.aws.neon.tech/neondb"
        normalized = normalize_database_url(neon_legacy)
        self.assertTrue(normalized.startswith("postgresql://"))
        self.assertIn("sslmode=require", normalized)

        neon_explicit = (
            "postgresql://user:pass@ep-cool.us-east-2.aws.neon.tech/neondb?sslmode=verify-full"
        )
        self.assertEqual(normalize_database_url(neon_explicit), neon_explicit)

        local_pg = "postgresql+psycopg2://u:p@db:5432/app"
        self.assertEqual(normalize_database_url(local_pg), local_pg)

        neon_psycopg2 = "postgresql+psycopg2://u:p@ep-demo.ap-southeast-1.aws.neon.tech/neondb"
        self.assertEqual(
            normalize_database_url(neon_psycopg2),
            f"{neon_psycopg2}?sslmode=require",
        )

    def test_build_sqlalchemy_engine_options_skips_sqlite_and_tunes_postgres(self):
        self.assertEqual(build_sqlalchemy_engine_options(None), {})
        self.assertEqual(build_sqlalchemy_engine_options("sqlite:///tmp/test.db"), {})

        with patch.dict(
            os.environ,
            {
                "DB_POOL_RECYCLE": "240",
                "DB_POOL_SIZE": "6",
                "DB_MAX_OVERFLOW": "12",
                "DB_POOL_TIMEOUT": "25",
                "DB_CONNECT_TIMEOUT": "15",
            },
        ):
            opts = build_sqlalchemy_engine_options(
                "postgresql://user:pass@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
            )
        self.assertTrue(opts["pool_pre_ping"])
        self.assertEqual(opts["pool_recycle"], 240)
        self.assertEqual(opts["pool_size"], 6)
        self.assertEqual(opts["max_overflow"], 12)
        self.assertEqual(opts["pool_timeout"], 25)
        self.assertEqual(opts["connect_args"], {"connect_timeout": 15})

    def test_create_app_derives_engine_options_from_effective_uri(self):
        fd, sqlite_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            sqlite_uri = f"sqlite:///{sqlite_path}"
            with patch.multiple(
                Config,
                SQLALCHEMY_DATABASE_URI=sqlite_uri,
                SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_size": 5},
                SECRET_KEY="test-neon-config-secret",
                SESSION_TYPE="cachelib",
                HF_INFERENCE_URL="",
                HUGGINGFACE_INFERENCE_URL="",
            ):
                app = create_app()
                self.assertEqual(app.config["SQLALCHEMY_DATABASE_URI"], sqlite_uri)
                self.assertEqual(app.config["SQLALCHEMY_ENGINE_OPTIONS"], {})
        finally:
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass

    def test_wait_for_database_uses_migration_url_and_hides_credentials(self):
        fd, sqlite_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            with patch.dict(
                os.environ,
                {
                    "DATABASE_URL": "postgresql://secretuser:secretpass@127.0.0.1:1/bad",
                    "DATABASE_URL_UNPOOLED": f"sqlite:///{sqlite_path}",
                    "MIGRATION_DATABASE_URL": "",
                },
                clear=False,
            ):
                # Passing --migration connects via DATABASE_URL_UNPOOLED cleanly without touching the broken URL.
                wait_for_database(use_migration_url=True)

            with patch.dict(
                os.environ,
                {
                    "DATABASE_URL": "postgresql://secretuser:secretpass@127.0.0.1:1/bad",
                    "DATABASE_URL_UNPOOLED": "",
                    "MIGRATION_DATABASE_URL": f"sqlite:///{sqlite_path}",
                },
                clear=False,
            ):
                # Fallback to legacy MIGRATION_DATABASE_URL remains supported.
                wait_for_database(use_migration_url=True)
        finally:
            try:
                os.unlink(sqlite_path)
            except OSError:
                pass

        with patch.dict(
            os.environ,
            {
                "DATABASE_URL": "",
                "DATABASE_URL_UNPOOLED": "",
                "MIGRATION_DATABASE_URL": "",
            },
            clear=False,
        ):
            with self.assertRaises(SystemExit) as ctx:
                wait_for_database(use_migration_url=True)
            self.assertNotIn("secretpass", str(ctx.exception))

    def test_get_unpooled_database_url_prefers_database_url_unpooled(self):
        with patch.dict(
            os.environ,
            {
                "DATABASE_URL_UNPOOLED": "postgres://u:p@ep-direct.ap-southeast-1.aws.neon.tech/neondb",
                "MIGRATION_DATABASE_URL": "postgresql://u:p@ep-legacy.ap-southeast-1.aws.neon.tech/neondb",
            },
            clear=False,
        ):
            self.assertEqual(
                get_unpooled_database_url(),
                "postgresql://u:p@ep-direct.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            )

        with patch.dict(
            os.environ,
            {
                "DATABASE_URL_UNPOOLED": "",
                "MIGRATION_DATABASE_URL": "postgres://u:p@ep-legacy.ap-southeast-1.aws.neon.tech/neondb",
            },
            clear=False,
        ):
            self.assertEqual(
                get_unpooled_database_url(),
                "postgresql://u:p@ep-legacy.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
            )

    def test_digitalocean_compose_and_caddy_configs_exist(self):
        compose_path = REPO_ROOT / "docker-compose.digitalocean.yml"
        caddy_path = REPO_ROOT / "deploy" / "Caddyfile"
        migration_doc = REPO_ROOT / "docs" / "digitalocean_neon_migration.md"

        self.assertTrue(compose_path.exists())
        self.assertTrue(caddy_path.exists())
        self.assertTrue(migration_doc.exists())

        compose_text = compose_path.read_text(encoding="utf-8")
        self.assertIn("DATABASE_URL=${DATABASE_URL}", compose_text)
        self.assertIn("DATABASE_URL_UNPOOLED=${DATABASE_URL_UNPOOLED:-}", compose_text)
        self.assertIn("MIGRATION_DATABASE_URL=${MIGRATION_DATABASE_URL:-}", compose_text)
        self.assertIn("./backend/uploads:/app/app/static/uploads", compose_text)
        self.assertNotIn("./backend/app:/app/app", compose_text)

    def test_wait_for_database_script_runs_in_docker_app_layout(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_root = _pathlib.Path(tmpdir)
            (tmp_root / "app").mkdir()
            shutil.copy2(
                REPO_ROOT / "backend" / "app" / "config.py",
                tmp_root / "app" / "config.py",
            )
            (tmp_root / "app" / "__init__.py").write_text("", encoding="utf-8")
            (tmp_root / "scripts").mkdir()
            script_copy = tmp_root / "scripts" / "wait_for_database.py"
            shutil.copy2(REPO_ROOT / "scripts" / "wait_for_database.py", script_copy)

            db_path = tmp_root / "probe.db"
            env = os.environ.copy()
            env.pop("PYTHONPATH", None)
            env["DATABASE_URL"] = f"sqlite:///{db_path}"
            env["DATABASE_URL_UNPOOLED"] = f"sqlite:///{db_path}"
            env["MIGRATION_DATABASE_URL"] = ""

            proc = subprocess.run(
                [_sys.executable, str(script_copy), "--migration"],
                cwd=str(tmp_root),
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(
                proc.returncode,
                0,
                msg=f"stdout={proc.stdout}\nstderr={proc.stderr}",
            )


if __name__ == "__main__":
    unittest.main()
