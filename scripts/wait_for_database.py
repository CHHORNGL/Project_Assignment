"""Wait for the configured PostgreSQL server without logging credentials."""
import os
import sys
import time
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

_ROOT_DIR = Path(__file__).resolve().parents[1]
for _candidate in (_ROOT_DIR / "backend", _ROOT_DIR):
    if _candidate.exists() and str(_candidate) not in sys.path:
        sys.path.insert(0, str(_candidate))

try:
    from dotenv import load_dotenv

    load_dotenv(_ROOT_DIR / ".env")
    load_dotenv()
except ImportError:
    pass

from app.config import normalize_database_url


def wait_for_database(use_migration_url: bool = False):
    raw_url = (
        os.environ.get("DATABASE_URL_UNPOOLED")
        or os.environ.get("MIGRATION_DATABASE_URL")
        or os.environ.get("DATABASE_URL")
        if use_migration_url
        else os.environ.get("DATABASE_URL")
    )
    url = normalize_database_url(raw_url)
    if not url:
        raise SystemExit("DATABASE_URL must be configured.")
    try:
        timeout = max(3, int(os.environ.get("DB_CONNECT_TIMEOUT", "10").strip() or "10"))
    except ValueError:
        timeout = 10

    connect_args = {} if url.lower().startswith("sqlite") else {"connect_timeout": timeout}
    engine = create_engine(url, connect_args=connect_args)
    try:
        for attempt in range(30):
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                return
            except OperationalError:
                if attempt == 29:
                    raise SystemExit(
                        "Database unavailable; check DATABASE_URL and networking."
                    ) from None
                time.sleep(2)
    finally:
        engine.dispose()


if __name__ == "__main__":
    wait_for_database("--migration" in sys.argv[1:])
