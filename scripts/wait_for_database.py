"""Wait for the configured PostgreSQL server without logging credentials."""
import os
import time

from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError


def wait_for_database():
    url = os.environ.get('DATABASE_URL')
    if not url:
        raise SystemExit('DATABASE_URL must be configured.')
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    engine = create_engine(url, connect_args={'connect_timeout': 5})
    try:
        for attempt in range(30):
            try:
                with engine.connect() as connection:
                    connection.execute(text('SELECT 1'))
                return
            except OperationalError:
                if attempt == 29:
                    raise SystemExit('Database unavailable; check DATABASE_URL and networking.') from None
                time.sleep(2)
    finally:
        engine.dispose()


if __name__ == '__main__':
    wait_for_database()
