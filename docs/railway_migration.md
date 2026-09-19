# Move AWS backend and PostgreSQL to Railway

## Current cutover state — 2026-09-16

The user confirmed readiness for the final write pause and Cloudflare switch.

- AWS container `project_assignment` is **stopped** to freeze writes. PostgreSQL,
  Redis and cloudflared remain running. Do not restart the old app after Railway
  starts accepting writes without reconciling the databases.
- Final frozen database backup: private backup directory file
  `20260916-final.dump` (447497 bytes, SHA-256
  `9fca142ee2826123d29efe0d46e14c7c5fcf81a0e89473feff72f22342d7c7ac`).
- Final uploads archive: `20260916-final-uploads.tar` (7429632 bytes).
- Restored atomically into new Railway database `agricultureexp_cutover_20260916`.
  All 31 tables match AWS by row count and full-row digest before app startup.
  All 18 upload files match the final frozen AWS snapshot by SHA-256.
- Backend DATABASE_URL now selects the new database. The original Railway
  database and private pre-cutover backups remain available for recovery.
- Deployment `dd8062d7-f0c4-40fb-a4ee-457a277470d6` reports SUCCESS. A query from
  the running backend confirms the new database, 18 users, 313 chat messages,
  and 250 notifications.
- HTTPS health (204), repeated login-page requests (200), and a restored banner
  (200) pass. Session cookies retain Secure, HttpOnly and SameSite=Lax.
- User has been instructed to change Cloudflare's existing root CNAME to
  `17kyy6xh.up.railway.app`, keep proxy enabled and TXT verification intact,
  and select SSL/TLS Full per Railway's proxied-domain documentation.
- User reports both Cloudflare changes saved. Railway logs at 02:48 UTC show
  successful Google authentication and subsequent authenticated dashboard,
  avatar, weather and profile requests returning 200.
- Automated public-domain checks from the Mac and AWS receive HTTP 403 with
  `cf-mitigated: challenge`, before reaching the app. Asked the user to confirm
  login and refresh at the public hostname in their browser.
- Railway still reports CNAME REQUIRES_UPDATE and certificate
  VALIDATING_OWNERSHIP despite verified TXT ownership. Direct custom-hostname
  TLS verification against the Railway origin fails hostname validation;
  the instructed Cloudflare Full setup uses Railway's default origin certificate.
  Do not claim certificate issuance or independently verified public routing yet.
- **Pending:** user's public-domain login/refresh result and final routing
  confirmation. AWS backend remains stopped; Railway now has live authenticated
  activity, so restarting the old AWS backend is not a safe automatic rollback.

The sections below preserve earlier migration history and general guidance.

## Confirmed migration scope

- Preserve the existing AWS users, password hashes, application records and uploads.
- Keep the public website at `https://agricultureexp.space`.
- Create a new Railway project with backend, PostgreSQL and Redis services.
- Restore and verify the AWS backup before enabling backend startup and changing
  Cloudflare routing. Do not create a replacement empty production database.

Railway CLI is authenticated, and project `agricultureexp` has been created:
https://railway.com/project/a00146da-7f56-41c2-990c-5f77adf23db7

Services created: Postgres, Redis, and `backend`.

Initial migration progress:

- SSH access confirmed using the user's existing key (private key remains on Mac).
- AWS PostgreSQL 15.19 backup and uploads downloaded to the private local directory
  `/Users/ahzarjy/migration-backups/agricultureexp/`; SHA-256 hashes match AWS.
- `railway-database-20260915-133440.dump` restored atomically into empty Railway
  PostgreSQL 18.6: 31 application tables and 18 users.
- `railway-uploads-20260915-133516.tar.gz` validated and extracted: 18 files.
- Backend persistent volume created at `/app/app/static/uploads`.
- AWS backend environment saved privately for migration, without printing secrets.

Verified continuation on 2026-09-16:

- Backend deployment `6b446088-8529-4463-9a30-b4a2dc466ae7` is running at
  https://backend-production-02b68.up.railway.app.
- Startup logs confirm existing-database migration and Gunicorn startup.
- Read-only database checks confirm 31 tables and 18 users.
- The uploads volume was empty. Copied all 18 backed-up files into
  `/app/app/static/uploads` without overwriting existing files; every SHA-256
  matches the local backup. The restored banner also matches over HTTPS.
- Both session Redis and rate-limit Redis respond to PING.
- `/healthz` returns 204; `/auth/login` returns 200 on repeated requests.
  The session cookie has Secure, HttpOnly and SameSite=Lax flags.
- Live settings include SESSION_TYPE=redis, TRUSTED_PROXY_COUNT=1 and
  SEED_ACCOUNTS=false. SameSite=Lax is retained for the same-origin Flask site.
- Database bootstrap tests (3) and session security tests (7) pass locally;
  `bash -n entrypoint.sh` passes.
- A dedicated Railway SSH key is registered as `agricultureexp-migration`.
  Its private key stays at `/Users/ahzarjy/.ssh/railway_agricultureexp`.

AWS remains the live source. The snapshot does not include subsequent writes.
Final write pause/copy, real-account browser login verification and Cloudflare
cutover are pending. No AWS shutdown or DNS changes were performed.
AWS SSH access re-established using `/Users/ahzarjy/Desktop/my-aws-key.pem`
as `ec2-user@47.128.76.155`. All four production containers are running.
Cloudflare dashboard access is still pending; the live origin uses cloudflared.

Additional cutover preparation on 2026-09-16:

- AWS has newer rows than Railway: chat_messages 313 vs 311, audit_logs 163 vs
  157, notifications 250 vs 249. Other table counts match, but equal counts do
  not prove equal content. Final full snapshot is still required after write pause.
- Downloaded a fresh live (not write-paused) backup to the private backup directory
  as `railway-database-20260916-precutover.dump`.
- Added custom domain `agricultureexp.space` to backend port 8080. Railway domain
  ID: `055e4bea-5c26-412a-af4f-38c7dc451056`.
- Required eventual CNAME: `@` → `17kyy6xh.up.railway.app`. Do not switch it until
  final sync and verification are complete.
- Ownership TXT can be added first without moving traffic: name `_railway-verify`,
  value `railway-verify=d6b3e2866e10d037c93dd638f2b9e75d3c2fe8c81546efc4f479222623e70547`.
- User added the TXT record; public DNS returns the exact expected value and
  Railway now reports `verification.verified=true`. CNAME still requires update;
  certificate status remains `VALIDATING_OWNERSHIP`.
- Saved a Railway rollback database backup privately as
  `railway-before-cutover-20260916-023219.dump` (448378 bytes), plus the original
  Postgres/backend variables in private JSON files. Do not commit these files.
- Asked whether the user is ready at Cloudflare for the coordinated final sync
  and CNAME change. No write pause has started while awaiting their readiness.

The user accesses AWS through the Management Console and runs PostgreSQL in
Docker. Re-establish EC2 SSH access and verify the current container inventory
before the final backup; Cloudflare DNS/origin access is also needed. The local `.env` points to
localhost:5435 and must not be assumed to identify the AWS production database.
An unauthenticated HTTP check received a Cloudflare challenge, so the current
origin and whether Cloudflare uses Pages or a proxy remain unverified.

The PostgreSQL 18.4 backup tools are installed locally under
`/opt/homebrew/opt/libpq/bin`. Confirm the AWS server version before selecting
the Railway version and running the backup.

First AWS terminal check (no credentials in output):

```sh
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

The local Compose file names the database `project_assignment_db` and backend
`project_assignment`; verify that the production containers match before export.

## Create services

Create PostgreSQL and Redis services in one Railway project, then connect this
repository as a backend service, with the repository root as its root directory.
The railway.json file selects the Dockerfile and /healthz deployment check.
Keep backend deployment paused until a data restore is finished if retaining AWS data.
Start with one backend replica: startup runs database migrations.

Add a backend volume mounted at `/app/app/static/uploads` and copy existing AWS
uploads into it before cutover. A database backup does not contain these files.
Use persistent volumes for PostgreSQL and Redis as well.

## Backend variables

These reference expressions assume services named `Postgres` and `Redis`; adjust
the names to match the project. Enter them in Railway's variables editor.

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_TYPE=redis
SESSION_REDIS_URL=${{Redis.REDIS_URL}}
RATELIMIT_STORAGE_URI=${{Redis.REDIS_URL}}
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=None
TRUSTED_PROXY_COUNT=1
WEB_CONCURRENCY=2
SEED_ACCOUNTS=false
```

The session and rate-limit keys have distinct prefixes and can share Redis's
default database. Keep SECRET_KEY stable across deployments and all workers;
copy it and required mail/OAuth/AI integration secrets through Railway's private
variables editor. Do not commit secrets. Railway supplies PORT automatically.
Verify the trusted proxy count against the final Cloudflare/Railway routing.

Startup waits for DATABASE_URL, bootstraps an empty database or upgrades an
existing versioned database, and seeds roles, permissions and rule knowledge.
Account seeding is now opt-in; existing accounts are not updated by seed scripts
on every deployment. For a fresh database, run `python seed_admin.py` once in the
backend environment after setting ADMIN_EMAIL and ADMIN_PASSWORD. Enabling
SEED_ACCOUNTS runs all three account scripts and needs admin/expert/farmer variables.

## Retain AWS data

1. Take a trial PostgreSQL custom-format backup and restore it into an empty Railway
   database. Use a pg_dump client at least as new as the AWS server and a compatible
   Railway PostgreSQL version. Use private credential files or environment variables.
2. Restore with `pg_restore --no-owner --no-acl --exit-on-error` targeting Railway.
   Include the full schema, data, sequences and alembic_version migration history.
   Use Railway's public TCP connection for a local restore; its private hostname is
   only reachable from the Railway network. Do not restore over an initialized app.
3. Compare table row counts, account records and uploaded files. Deploy the backend
   to apply pending migrations, then test login, refresh, navigation, uploads and APIs.
4. For final cutover, pause AWS writes, take the final backup and upload copy, and
   restore into a fresh Railway database before starting the production backend.
   Switch Cloudflare routing only after validation. Retain the AWS backup.
5. Existing sessions in AWS Redis will not be migrated; users sign in once again.
   Rollback after accepting new Railway writes needs reconciliation to avoid losing
   those writes; do not simply point traffic back at the old database.

## Cloudflare and authentication

This repository serves its login pages through Flask; its React build is an
embedded diagnosis widget, not a standalone login frontend. Determine whether
Cloudflare currently proxies Flask or hosts a separate frontend before switching.

If Cloudflare proxies the app, update its origin to the Railway backend and keep
the existing public hostname, paths, cookies and HTTPS behavior. Bypass cache for
login and authenticated responses. Do not migrate the old AWS Cloudflare tunnel
container automatically; Railway provides its own public ingress.

If using a separate Cloudflare Pages frontend, update its API destination and
verify credentialed requests and the exact allowed CORS origin. Prefer an API
hostname under the same parent domain or a same-origin proxy. Unrelated Pages and
Railway domains can still have third-party cookie failures; a hosting migration
alone does not fix the reported immediate logout. Update OAuth callback URLs if
the public login hostname changes.

## References

- https://docs.railway.com/guides/docker-compose
- https://docs.railway.com/variables
- https://docs.railway.com/deployments/healthchecks
- https://docs.railway.com/databases/postgresql

## Local checks

```sh
bash -n entrypoint.sh
.venv/bin/python -m unittest discover -s tests -p test_database_bootstrap.py -v
.venv/bin/python -m unittest discover -s tests -p test_session_security.py -v
```

Live deployment, backup/restore, DNS cutover and browser authentication must still
be verified against the actual Railway project and Cloudflare domain.
