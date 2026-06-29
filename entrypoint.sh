#!/bin/bash
set -e

# Wait for PostgreSQL to be ready to accept connections
echo "⏳ Waiting for PostgreSQL database..."
until pg_isready -h db -p 5432 -U postgres; do
  sleep 1
done
echo "✅ PostgreSQL database is ready!"

# Run database initialization and stamp migrations
echo "🔄 Initializing database schema (setup_db.py)..."
python setup_db.py
echo "🔄 Stamping migrations to head..."
flask db stamp head

# Run seed scripts in app context
echo "🌱 Running database seeds..."
python seed_roles.py || echo "⚠️ seed_roles.py failed or skipped"
python seed_permissions.py || echo "⚠️ seed_permissions.py failed or skipped"
python seed_admin.py || echo "⚠️ seed_admin.py failed or skipped"
python seed_expert.py || echo "⚠️ seed_expert.py failed or skipped"
python seed_farmer.py || echo "⚠️ seed_farmer.py failed or skipped"
python seed_rule_based_knowledge.py || echo "⚠️ seed_rule_based_knowledge.py failed or skipped"

# Start the Gunicorn production server
echo "🚀 Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 "run:app"
