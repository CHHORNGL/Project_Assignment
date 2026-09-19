#!/bin/bash
set -e

# Wait for PostgreSQL to be ready to accept connections
echo "⏳ Waiting for PostgreSQL database..."
python scripts/wait_for_database.py
echo "✅ PostgreSQL database is ready!"

# Initialize fresh databases and apply pending migrations to existing databases
echo "🔄 Initializing database schema (setup_db.py)..."
python setup_db.py
echo "🔄 Applying database migrations..."
flask db upgrade

# Run seed scripts in app context
echo "🌱 Running database seeds..."
python seed_roles.py || echo "⚠️ seed_roles.py failed or skipped"
python seed_permissions.py || echo "⚠️ seed_permissions.py failed or skipped"
if [ "${SEED_ACCOUNTS:-false}" = "true" ]; then
  python seed_admin.py
  python seed_expert.py
  python seed_farmer.py
fi
python seed_rule_based_knowledge.py || echo "⚠️ seed_rule_based_knowledge.py failed or skipped"

# Start the Gunicorn production server
echo "🚀 Starting Gunicorn server..."
exec gunicorn --bind "0.0.0.0:${PORT:-5000}" --workers "${WEB_CONCURRENCY:-2}" --timeout 120 "run:app"
