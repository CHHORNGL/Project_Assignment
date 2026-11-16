"""Bootstrap an empty database without skipping migrations on existing installs."""
from sqlalchemy import inspect


def initialize_database(database, stamp_revision):
    tables = set(inspect(database.engine).get_table_names())
    application_tables = tables - {'alembic_version'}
    if not application_tables:
        # A fresh database can be created directly from the current models.
        database.create_all()
        stamp_revision(revision='head')
        print('Database initialized from current models')
    elif 'alembic_version' not in tables:
        raise RuntimeError(
            'Existing database has no migration history. Back it up and establish '
            'its matching Alembic revision before starting; refusing to stamp head.'
        )
    else:
        print('Existing database detected; pending migrations will run next')
        try:
            from sqlalchemy import text
            with database.engine.begin() as conn:
                conn.execute(text("ALTER TABLE diseases ADD COLUMN IF NOT EXISTS cause_explanation_kh TEXT;"))
                conn.execute(text("ALTER TABLE diseases ADD COLUMN IF NOT EXISTS prevention_tips_kh TEXT;"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 13000;"))
                conn.execute(text("ALTER TABLE roles ADD COLUMN IF NOT EXISTS route_type VARCHAR(50) DEFAULT 'farmer';"))
                conn.execute(text("ALTER TABLE expert_diagnoses ADD COLUMN IF NOT EXISTS image_paths JSON;"))
        except Exception:
            pass


if __name__ == '__main__':
    import os
    import sys
    from pathlib import Path

    from dotenv import load_dotenv

    BACKEND_DIR = Path(__file__).resolve().parent
    REPO_ROOT = BACKEND_DIR.parent
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(BACKEND_DIR / ".env")

    from app.config import get_unpooled_database_url

    current_db_url = (os.environ.get("DATABASE_URL") or "").strip().lower()
    direct_db_url = get_unpooled_database_url()
    if direct_db_url and not current_db_url.startswith("sqlite"):
        os.environ["DATABASE_URL"] = direct_db_url

    from app import create_app
    from app.extensions import db
    from flask_migrate import stamp

    app = create_app()
    with app.app_context():
        initialize_database(db, stamp)
