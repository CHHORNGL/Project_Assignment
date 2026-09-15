# Project health check — 15 September 2026

## Fixes

- Docker startup now upgrades existing databases instead of stamping pending migrations as applied. Empty databases are created from current models and stamped once. Existing unversioned databases stop with an actionable error rather than silently claiming to be current.
- Added a web health check against `/healthz`, with a startup grace period for initialization and seeds.
- Guarded mobile AI-settings and image-diagnosis screen updates after asynchronous work, preventing updates after the screen is disposed.
- Replaced deprecated Flutter color/switch APIs and resolved analyzer findings. Diagnosis error logging no longer prints whole server response bodies.

## Validation

- 47 Python unit tests passed, including three new database-bootstrap regression tests.
- 10 JavaScript tests passed.
- Production React/Vite build passed.
- Dart analysis of all `mobile/lib` reported no issues.
- Python source compilation, 11 standalone JavaScript syntax checks, 13 CSS parses and shell syntax checks passed.
- Installed Python dependencies passed `pip check`.
- Database model comparison found no missing columns or nullability differences.
- Read-only rendering checks exercised 28 farmer/expert/admin pages: 27 returned HTTP 200; fact creation redirected correctly because no source exists. Checks used isolated sessions and read-only PostgreSQL transactions.

## Limits

This is a code, build and server-rendering check, not a guarantee that every user flow is error-free. No physical-device/emulator run or browser visual review was performed. Paid AI providers, email delivery, external authentication, payments, uploads and destructive administrative actions were not exercised against live services.
