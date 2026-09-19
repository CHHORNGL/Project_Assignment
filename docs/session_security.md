# Secure session management

Flask-Session now stores session data on the server. The browser receives only a
random 32-byte session identifier, rather than Flask's signed but readable session
payload. This keeps pending verification codes and authentication state out of
the browser cookie. The cookie name remains `session` for mobile compatibility.

## Lifecycle

- Successful password, OTP, Google/Telegram, registration, and passkey logins trigger
  a Flask-Login signal that clears pre-authentication state, creates a new session
  identifier, and deletes the prior session record.
- Logout deletes the old session record and clears all verification/reset state.
  A copied cookie cannot restore that session after logout completes.
- Sessions last up to 15 days from login, including time without activity and
  browser restarts. Both timeout settings default to 1296000 seconds. Activity
  cannot extend the 15-day deadline; the next dynamic request at or after it
  signs the user out. Static assets, health checks and preflights do not renew activity.
- Password changes/resets and account bans invalidate existing authenticated
  sessions on their next dynamic request. A server-only HMAC of the password hash
  detects changes without a schema migration. Automatic password-hash upgrades
  also invalidate other sessions; the new login receives a fresh credential stamp.
- Long-lived remember-me tokens are no longer issued. Existing remember cookies
  are cleared and cannot bypass the new session policy.
- Expired/missing API authentication returns JSON HTTP 401. Browser expiration
  uses the existing login redirect. Private/auth responses use Cache-Control
  no-store to reduce cached authenticated content after logout.
- The final JSON password-reset action now checks OTP expiry before changing the
  password. Issuing an OTP does not create an authenticated session.

Timeouts are configurable in seconds via SESSION_IDLE_TIMEOUT_SECONDS and
SESSION_ABSOLUTE_TIMEOUT_SECONDS. Current sessions are not bound to a fixed IP,
so changing mobile networks does not itself force logout. In-flight requests that
already authenticated are not cancelled by logout/password change.

## Cookies and storage

Cookies explicitly use HttpOnly, Secure, host-only scope, and Path=/.
SameSite=None preserves the existing cross-site frontend and requires HTTPS.
For same-site hosting use SESSION_COOKIE_SAMESITE=Lax. For HTTP-only local browser
development, set SESSION_COOKIE_SECURE=false and SESSION_COOKIE_SAMESITE=Lax;
never use that insecure transport setting in production.

Production Compose uses the existing private Redis service, database 1, with
prefix agri:session:. Rate limits continue using Redis database 0. Every worker
and application instance must use the same session store and stable SECRET_KEY.
Redis failures fail requests rather than falling back to unrevocable client-side
sessions. Keep Redis private and monitor capacity and availability.

Local development defaults to CacheLib files inside instance/sessions (ignored
by Git, private directory and file modes). Tests use isolated SimpleCache stores.
These local files must not be publicly served or shared with untrusted processes.
SECRET_KEY must be configured; there is no hardcoded fallback.

## Mobile client

Cookie handling now extracts and awaits storage of only the session name/value,
including when a response also deletes a remember cookie. This preserves the
rotated session after OTP or Google authentication. Mobile logout calls the server
before deleting its local cookie. If offline, local logout still completes, but
server revocation cannot happen until connectivity returns; the old server session
remains subject to its timeouts.

The existing mobile API base URL is still a local HTTP development address.
Production mobile traffic must use your HTTPS API hostname. Cookies are still
stored in SharedPreferences; moving them into platform secure storage is separate
mobile hardening. No full device/emulator flow was run for this change.

## Activation and limits

Restart the local app, or rebuild/recreate the Docker web service with Redis.
Deploy the updated mobile client alongside the backend. Existing browser/mobile
sessions will need to sign in again. No SQL schema migration is required.

On 2026-09-16, Railway's backend timeout variables were set to 1296000 seconds
and deployment `89236815-fbdd-4290-b7e2-f1f9d1a634c7` completed successfully using the
existing image's configurable session policy. Runtime config confirms both timeouts
and permanent cookie lifetime are 1296000 seconds; an HTTPS login-page check
receives a cookie expiring in 15 days. All eight session tests pass, including
inactivity followed by expiry exactly at day 15 despite recent activity.
Local defaults and `.env.example`
also use 15 days for future builds. Existing session records/cookies keep their
old storage expiry until refreshed; signing in again starts a full new 15-day period.

Server-side sessions do not replace CSRF protection, an explicit CORS origin
allowlist, or correct authentication verification. The existing permissive CORS
policy and the previously identified Telegram login bypass remain separate issues.

## Validation

```sh
.venv/bin/python -m unittest discover -s tests -v
dart tests/session_cookie_test.dart
dart analyze mobile/lib/services/api_service.dart mobile/lib/services/session_cookie.dart
docker compose config --quiet
```

Tests exercise cookie flags, ID rotation, pre-auth cleanup, copied-cookie replay
after logout, idle/absolute expiry, password-change and ban invalidation, legacy
remember-token rejection, private cache headers, and expired reset-code rejection.
Mobile cookie parsing covers combined headers and session deletion. Dart analysis
has no errors or warnings; eight existing informational style findings remain.

Reference: https://flask-session.readthedocs.io/en/latest/security.html
