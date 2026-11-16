# DigitalOcean Backend + Neon PostgreSQL Migration Guide

This guide covers deploying the Flask + React + Redis backend on a **DigitalOcean Droplet** using [docker-compose.digitalocean.yml](../docker-compose.digitalocean.yml) while hosting PostgreSQL externally on **Neon**.

## Architecture Overview

- **Compute (DigitalOcean Droplet):** Runs the Dockerized Flask/Gunicorn backend (`web`), persistent `redis:7-alpine` (sessions, rate limiting, weather cache), and either **Caddy** (`--profile caddy`, automatic Let's Encrypt TLS) or **Cloudflare Tunnel** (`--profile tunnel`).
- **Database (Neon Serverless PostgreSQL):**
  - `DATABASE_URL` uses Neon's **pooled** (`-pooler`) hostname for Gunicorn runtime queries.
  - `DATABASE_URL_UNPOOLED` (populated automatically by `neon init` / `neon deploy` / `neon env pull`, with `MIGRATION_DATABASE_URL` supported as fallback) uses Neon's **direct** (non-pooler) hostname so [entrypoint.sh](../backend/entrypoint.sh), [setup_db.py](../backend/setup_db.py), and [migrations/env.py](../backend/migrations/env.py) run schema init and `flask db upgrade` safely without PgBouncer transaction-mode conflicts.
  - SQLAlchemy automatically enables `pool_pre_ping=True`, `pool_recycle=280` (under Neon's idle auto-suspend threshold), `connect_timeout=10`, and `sslmode=require` on `*.neon.tech` hosts.
  - `/healthz` returns `204` without querying PostgreSQL so container health probes do not keep Neon compute awake unnecessarily.
- **Uploads (Persistent Volume):** `./backend/uploads` on the Droplet is bind-mounted into `/app/app/static/uploads` so avatars, support-chat attachments, and disease reference images survive container rebuilds.

---

## 1. Provision Neon PostgreSQL

1. Create a Neon project and database (PostgreSQL 15+ in a region close to your DigitalOcean Droplet, e.g. Singapore `aws-ap-southeast-1` / Frankfurt `aws-eu-central-1` / US East).
2. In the Neon dashboard (**Connection Details**) or via `neon deploy` / `neon env pull`, get **both** URLs:
   - **Pooled connection** (contains `-pooler` in the hostname) -> `DATABASE_URL`
   - **Direct connection** (no `-pooler` in the hostname) -> `DATABASE_URL_UNPOOLED`
   Ensure both end with `?sslmode=require` (the app also enforces `sslmode=require` automatically for `*.neon.tech`).

---

## 2. Migrate Existing PostgreSQL Data & Uploads (If Preserving Production Data)

Run these commands from your local machine or current host with `libpq` (`pg_dump` / `pg_restore` installed under `/opt/homebrew/opt/libpq/bin` on macOS):

### A. Database backup & restore into Neon

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# 1. Dump current source database (Railway or local/AWS Docker)
pg_dump "$SOURCE_DATABASE_URL" --format=custom --no-owner --no-acl -f pre_neon_cutover.dump

# 2. Restore into the empty Neon DIRECT (non-pooler) URL
pg_restore --dbname="$DATABASE_URL_UNPOOLED" --no-owner --no-acl --exit-on-error pre_neon_cutover.dump

# 3. Sanity-check row counts
psql "$DATABASE_URL_UNPOOLED" -c "SELECT count(*) AS users FROM users;"
psql "$DATABASE_URL_UNPOOLED" -c "SELECT version_num FROM alembic_version;"
```

> **Important:** Run `pg_restore` into an **empty** Neon database before starting the DigitalOcean container for the first time, so Alembic history (`alembic_version`) is preserved and `flask db upgrade` only applies incremental migrations.

### B. Copy uploaded media to the DigitalOcean Droplet

```bash
# Pack existing uploads cleanly
tar -C backend/uploads -czf uploads-backup.tar.gz .

# Copy to the Droplet and extract into ./backend/uploads
scp uploads-backup.tar.gz deploy@YOUR_DROPLET_IP:~/Project_Assignment/
ssh deploy@YOUR_DROPLET_IP "mkdir -p ~/Project_Assignment/backend/uploads && tar -C ~/Project_Assignment/backend/uploads -xzf ~/Project_Assignment/uploads-backup.tar.gz"
```

---

## 3. Configure the DigitalOcean Droplet

1. Create an **Ubuntu 24.04 LTS** Droplet (minimum 2 GB RAM / 1–2 vCPU recommended for Docker image builds + 2 Gunicorn workers + Redis).
2. Install Docker & Compose plugin, then enable UFW firewall:
   ```bash
   sudo ufw allow OpenSSH
   # Skip 80/443 if using Cloudflare Tunnel (--profile tunnel)
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
3. Clone the repository on the Droplet:
   ```bash
   git clone https://github.com/CHHORNGL/Project_Assignment.git
   cd Project_Assignment
   cp .env.example .env
   mkdir -p backend/uploads
   ```
4. Edit `.env` with your production values (never commit `.env`):
   ```env
   FLASK_ENV=production
   SECRET_KEY=<keep-existing-production-secret-or-generate-64-hex>

   DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require

   DB_POOL_SIZE=5
   DB_MAX_OVERFLOW=10
   DB_POOL_RECYCLE=280
   DB_CONNECT_TIMEOUT=10

   APP_DOMAIN=agricultureexp.space
   SESSION_COOKIE_SECURE=true
   SESSION_COOKIE_SAMESITE=Lax
   WEB_CONCURRENCY=2
   SEED_ACCOUNTS=false
   ```
   Set `TRUSTED_PROXY_COUNT` to match your ingress path:
   - **Caddy directly on Droplet (DNS-only / gray cloud)** -> `TRUSTED_PROXY_COUNT=1`
   - **Cloudflare Proxy (orange cloud) -> Caddy on Droplet** -> `TRUSTED_PROXY_COUNT=2`
   - **Cloudflare Tunnel (`cloudflared` profile)** -> `TRUSTED_PROXY_COUNT=1`

---

## 4. Build & Start on DigitalOcean

Choose **one** ingress mode:

- **Option A — Built-in Caddy automatic HTTPS (recommended for direct DNS):**
  ```bash
  docker compose -f docker-compose.digitalocean.yml --profile caddy up -d --build
  ```
- **Option B — Cloudflare Tunnel (zero exposed inbound ports `80`/`443`):**
  Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env` and run:
  ```bash
  docker compose -f docker-compose.digitalocean.yml --profile tunnel up -d --build
  ```
- **Option C — Existing Host Nginx:**
  ```bash
  docker compose -f docker-compose.digitalocean.yml up -d --build
  ```
  Proxy your Nginx `server` block to `http://127.0.0.1:5000` forwarding `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`.

Verify health and startup logs:

```bash
docker compose -f docker-compose.digitalocean.yml ps
docker compose -f docker-compose.digitalocean.yml logs -f web
curl -i http://127.0.0.1:5000/healthz
```

---

## 5. DNS, OAuth & Post-Cutover Checklist

1. **Cloudflare / DNS:** Point `A` record for `agricultureexp.space` (and `www` if used) to your DigitalOcean Droplet IPv4 address (or update your Cloudflare Tunnel origin to `http://web:5000`).
2. **Google OAuth:** In Google Cloud Console, confirm the authorized redirect URI matches `https://<your-domain>/auth/google/callback`.
3. **Passkeys (WebAuthn):** Verify passkeys automatically resolve `rp_id` for your active domain (note existing passkeys registered on `agricultureexp.space` continue working as long as the public hostname stays `agricultureexp.space`).
4. **Verify live flows:** Sign in as Admin, Expert, and Farmer, refresh the page (checks Redis session persistence), upload an avatar or chat attachment (checks `./backend/uploads`), and check `/weather-intelligence/api/v1/summary`.
5. **Decommission Railway safely:** Only stop/remove Railway Postgres & backend services after live verification and retaining your `pre_neon_cutover.dump` backup.
