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
        except Exception:
            pass


if __name__ == '__main__':
    from flask_migrate import stamp
    from app import create_app
    from app.extensions import db

    app = create_app()
    with app.app_context():
        initialize_database(db, stamp)
