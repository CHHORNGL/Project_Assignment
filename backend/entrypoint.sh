#!/bin/bash
set -e

cd "$(dirname "$0")"

# Wait for PostgreSQL / Neon to wake and accept connections
echo "⏳ Waiting for PostgreSQL database..."
if [ -f "scripts/wait_for_database.py" ]; then
  python scripts/wait_for_database.py --migration
else
  python ../scripts/wait_for_database.py --migration
fi
echo "✅ PostgreSQL database is ready!"

# Run schema initialization, Alembic migrations, and seeds against Neon's direct URL
# (DATABASE_URL_UNPOOLED / MIGRATION_DATABASE_URL) when provided so PgBouncer transaction poolers do not interfere.
RUNTIME_DATABASE_URL="${DATABASE_URL:-}"
DIRECT_DATABASE_URL="${DATABASE_URL_UNPOOLED:-${MIGRATION_DATABASE_URL:-}}"
if [ -n "${DIRECT_DATABASE_URL}" ]; then
  export DATABASE_URL="${DIRECT_DATABASE_URL}"
fi

# Initialize fresh databases and apply pending migrations to existing databases
echo "🔄 Initializing database schema (setup_db.py)..."
python setup_db.py
echo "🔄 Applying database migrations..."
flask db upgrade

# Run seed scripts in app context
echo "🌱 Running database seeds..."
python seeds/seed_roles.py || echo "⚠️ seed_roles.py failed or skipped"
python seeds/seed_permissions.py || echo "⚠️ seed_permissions.py failed or skipped"
if [ "${SEED_ACCOUNTS:-false}" = "true" ]; then
  python seeds/seed_admin.py
  python seeds/seed_expert.py
  python seeds/seed_farmer.py
fi
python seeds/seed_rule_based_knowledge.py || echo "⚠️ seed_rule_based_knowledge.py failed or skipped"

# Restore pooled runtime URL (if DATABASE_URL_UNPOOLED / MIGRATION_DATABASE_URL overrode DATABASE_URL above)
if [ -n "${RUNTIME_DATABASE_URL:-}" ]; then
  export DATABASE_URL="${RUNTIME_DATABASE_URL}"
fi

# Ensure writable upload & log directories exist on mounted disks (e.g. Render Persistent Disk)
mkdir -p /app/app/static/uploads /app/app/static/uploads/banners /app/app/static/uploads/chats /app/app/static/uploads/theme_animations /app/instance/logs

# Seed bundled static uploads onto the mounted Persistent Disk without overwriting existing files
if [ -d "/app/_bundled_uploads" ]; then
  cp -rn /app/_bundled_uploads/. /app/app/static/uploads/ 2>/dev/null || true
fi
if [ -d "/app/uploads" ]; then
  cp -rn /app/uploads/. /app/app/static/uploads/ 2>/dev/null || true
fi

# Start the Gunicorn production server
echo "🚀 Starting Gunicorn server..."
exec gunicorn \
  --config gunicorn.conf.py \
  --bind "0.0.0.0:${PORT:-5000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout "${GUNICORN_TIMEOUT:-180}" \
  --access-logfile - \
  --error-logfile - \
  "run:app"
