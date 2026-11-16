# Render Backend + Security + Neon PostgreSQL Migration Guide

This guide covers deploying the Flask + React backend and security stack on **Render** using the [render.yaml](../render.yaml) Blueprint while keeping your existing **Neon Serverless PostgreSQL** database and **Cloudflare** edge proxy.

## Architecture Overview

- **Web Service (`agrisense-backend` on Render Starter):**
  - Built from [Dockerfile](../Dockerfile) (`runtime: docker`) in **Singapore** (`region: singapore`), co-located near Neon `aws-ap-southeast-1`.
  - Runs **Gunicorn** via [entrypoint.sh](../backend/entrypoint.sh) and [gunicorn.conf.py](../backend/gunicorn.conf.py), binding `0.0.0.0:$PORT` with `WEB_CONCURRENCY=2`, `timeout=180`, `keepalive=65`, `max_requests=1000`, and masked `Server: webserver` response headers.
  - Uses `/healthz` (`204 No Content`, no DB query) as Render's health check path so Neon compute can still scale to zero during idle periods.
- **Persistent Uploads (`agrisense-uploads`):**
  - A **10 GB Render Persistent Disk** mounted at `/app/app/static/uploads` retains diagnosis photos, user avatars, and support-chat attachments across redeploys and restarts.
  - [entrypoint.sh](../backend/entrypoint.sh) ensures `/app/app/static/uploads/chats`, `/app/app/static/uploads/theme_animations`, and `/app/instance/logs` exist at boot.
- **Private Redis (`agrisense-kv`):**
  - A **Render Key Value** instance (`type: keyvalue`, `plan: starter`, `ipAllowList: []` private-network-only) supplies `REDIS_URL` via `fromService` for Flask server-side sessions (`SESSION_TYPE=redis`), shared multi-worker rate limiting (`RATELIMIT_STORAGE_URI`), live support-chat typing indicators, and weather forecast caching.
- **External Database (Neon Serverless PostgreSQL):**
  - `DATABASE_URL` uses Neon's **pooled** (`-pooler`) URL for runtime Gunicorn workers.
  - `DATABASE_URL_UNPOOLED` uses Neon's **direct** URL for [entrypoint.sh](../backend/entrypoint.sh) migrations (`setup_db.py`, `flask db upgrade`, rule-engine seeding).
- **Security Stack on Render + Cloudflare:**
  - `TRUSTED_PROXY_COUNT=2` configures Werkzeug `ProxyFix` in [backend/app/__init__.py](../backend/app/__init__.py) with `x_for=2` (Cloudflare edge + Render ingress) while keeping `x_proto=1`, `x_host=1`, and `x_prefix=1` so `request.remote_addr`, `request.is_secure`, HSTS, and OAuth callback URLs remain accurate.
  - `CORS_ALLOWED_ORIGINS` (or derived `APP_DOMAIN` + `RENDER_EXTERNAL_URL`) restricts credentialed cross-origin requests cleanly (`Access-Control-Allow-Origin` wildcard `*` is never used in production).
  - `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_HTTPONLY=true`, `SESSION_COOKIE_SAMESITE=Lax`, CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy: same-origin`, `X-Robots-Tag`, and `/robots.txt` (`Disallow: /`) run automatically inside the Flask app.

---

## 1. Push Code & Create Render Blueprint

1. Commit and push your repository changes (including [render.yaml](../render.yaml)) to GitHub (`git push` only when you are ready).
2. In the **Render Dashboard**, choose **New + -> Blueprint** and connect your GitHub repository.
3. Render parses [render.yaml](../render.yaml) and prepares two services in Singapore:
   - `agrisense-kv` (Key Value, Starter, private network only)
   - `agrisense-backend` (Docker Web Service, Starter, 10 GB disk at `/app/app/static/uploads`)

---

## 2. Configure Secrets (`sync: false`) in Render

During Blueprint creation (or in **Environment -> Environment Variables** for `agrisense-backend`), populate the secret values from your secure local `.env` without committing them:

- **PostgreSQL (Neon `orange-sound-47384541` / `production`):**
  - `DATABASE_URL` = pooled Neon URL (`postgresql://...-pooler....aws.neon.tech/neondb?sslmode=require`)
  - `DATABASE_URL_UNPOOLED` = direct Neon URL (`postgresql://...ep-...aws.neon.tech/neondb?sslmode=require`)
- **Existing App Secret (Important if migrating active users/TOTP/saved HF key):**
  - [render.yaml](../render.yaml) sets `generateValue: true` on `SECRET_KEY` for fresh installs. If you are migrating an existing database with encrypted credentials or active sessions, overwrite `SECRET_KEY` with your existing production `SECRET_KEY` before users sign in.
- **Self-Trained AI & External Services:**
  - `HF_TOKEN`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `BREVO_API_KEY`
  - `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`
  - `BAKONG_TOKEN`, `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` (optional)
  - `CORS_ALLOWED_ORIGINS` (optional comma-separated list; defaults automatically to `https://<APP_DOMAIN>`, `https://www.<APP_DOMAIN>`, and `https://<RENDER_EXTERNAL_HOSTNAME>`)

> **Database Initialization:** Because your Neon database already contains the schema (`alembic_version`) and seeded crop knowledge, leave `SEED_ACCOUNTS=false`. Only set `SEED_ACCOUNTS=true` temporarily if deploying against a brand-new empty database.

---

## 3. Custom Domain & Cloudflare Proxy Setup

1. In Render **Settings -> Custom Domains** for `agrisense-backend`, add `www.agricultureexp.com` and `agricultureexp.com`.
2. In **Cloudflare DNS**:
   - Point `CNAME` (`www` and root `@`) to Render's provided `<service>.onrender.com` target with **Proxy status: Proxied (orange cloud)**.
   - Set Cloudflare **SSL/TLS encryption mode** to **Full (strict)**.
   - Keep `TRUSTED_PROXY_COUNT=2` in Render (`x_for=2` strips Cloudflare + Render proxy hops; `x_proto=1` keeps HTTPS detection active).
   - If you ever switch Cloudflare to **DNS only (gray cloud)**, set `TRUSTED_PROXY_COUNT=1` in Render Environment Variables so client IPs cannot be spoofed.
3. In **Google Cloud Console -> OAuth 2.0 Credentials**:
   - Confirm authorized redirect URI includes `https://www.agricultureexp.com/auth/google/callback` (plus `https://agricultureexp.com/auth/google/callback` and `https://<your-service>.onrender.com/auth/google/callback` if testing via the Render hostname).

---

## 4. Migrate Existing Uploaded Media (Optional)

If you have existing images/audio in `./backend/uploads` or `./backend/app/static/uploads` from a prior host:

```bash
# Archive locally or on old VPS:
tar -C backend/uploads -czf uploads-backup.tar.gz .
```

Upload the archive temporarily via object storage / SCP, open the **Render Shell** on `agrisense-backend`, download it cleanly into `/tmp/uploads-backup.tar.gz`, extract into `/app/app/static/uploads`, and remove the temporary archive:

```bash
mkdir -p /app/app/static/uploads/chats /app/app/static/uploads/theme_animations
tar -C /app/app/static/uploads -xzf /tmp/uploads-backup.tar.gz
rm -f /tmp/uploads-backup.tar.gz
```

---

## 5. Post-Cutover Verification

```bash
# 1. Health & Crawler Blocking
curl -i https://www.agricultureexp.com/healthz
curl -i https://www.agricultureexp.com/robots.txt

# 2. Security Headers & Masked Server Banner
curl -sI https://www.agricultureexp.com/farmer/dashboard | grep -iE "server:|x-frame-options|x-robots-tag|cross-origin-resource-policy|content-security-policy|strict-transport-security"

# 3. Verify Strict CORS Rejection for Untrusted Origins
curl -sI -H "Origin: https://untrusted-site.example" https://www.agricultureexp.com/healthz | grep -i "access-control-allow-origin" || echo "Rejected cleanly (no ACAO header)"
```

Verify interactively in the browser:
- Sign in on your custom domain and refresh the page (`SESSION_TYPE=redis` persists across both Gunicorn workers).
- Trigger `/weather-intelligence/api/v1/summary` and verify support-chat attachment upload on `/app/app/static/uploads`.
- Keep your prior host stopped only after DNS cutover propagates cleanly and Render logs show zero 5xx errors.
