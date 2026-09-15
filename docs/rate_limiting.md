# Rate limiting and DDoS protection

Flask-Limiter now checks shared per-IP budgets before executing views. The limits
are configurable through environment variables; the defaults are:

| Scope | Per minute | Per hour |
| --- | --- | --- |
| All dynamic requests combined | 300 | 3000 |
| Password, OAuth-token, passkey verification, and OTP verification POSTs | 10 | 100 |
| Registration, email/OTP sending, and password-recovery POSTs | 5 | 20 |
| Assistant, chat, and diagnosis POSTs | 30 | 300 |

A client shares each sensitive budget across the relevant web/mobile routes.
The general budget still applies to sensitive routes. Sensitive GETs use only the
 general budget. Flask static files, `/healthz`, and OPTIONS preflight requests are
excluded from the general budget. Missing routes count toward the general budget.
The combined reset API handles sending, checking, and resetting in one endpoint,
so all its actions share the recovery budget.

Responses exceeding a limit return HTTP 429 with JSON `error` and `code` fields,
`Retry-After` in seconds, and X-RateLimit headers. The client should display the
error and wait before retrying. Fixed windows can allow bursts across a window
boundary. Shared public IPs (schools, offices, mobile carriers) share budgets;
adjust thresholds based on real traffic. These are IP limits, not account-based
lockouts: distributed attackers using many IPs need additional edge/account controls.

## Running locally and in production

The dependency is pinned in requirements.txt and installed in the local virtual
environment. Restart the local application to load the changes.

The default `memory://` store is for a single development process only. It resets
on restart and is not shared across workers. Docker Compose configures persistent
Redis with a health check, and all four Gunicorn workers use it. Redis has no host
port published. No database migration is required. Rebuild/restart the Compose
services during deployment to install the new dependency and start Redis.

Outside Compose, set `RATELIMIT_STORAGE_URI` to your private Redis service before
running multiple workers/instances. All instances must use the same Redis store
and key prefix. Redis failures do not silently disable protection or fall back to
per-worker counters: affected requests fail with a server error until Redis is
available. Monitor Redis health, capacity, and latency.

## Trusted client IPs and origin protection

Direct local access defaults to `TRUSTED_PROXY_COUNT=0`: supplied forwarding headers
cannot choose the limiter IP. Compose sets it to 1 for the Cloudflare Tunnel hop.
Only enable forwarding trust when the ingress is trusted and direct origin access
is blocked. If another proxy is inserted, verify which headers it overwrites and
adjust the hop count to the actual topology. Do not blindly trust arbitrary
`CF-Connecting-IP` or `X-Forwarded-For` values from public clients.

Compose now binds backend port 5000 and PostgreSQL port 5435 to 127.0.0.1.
Cloudflared should reach the application using `http://web:5000` on the Docker
network. Localhost access still works; direct LAN/public access through those
published ports no longer works. Restrict origin inbound access with the host or
cloud firewall too. These Compose changes take effect after recreating containers.

## What DDoS protection still requires

Application rate limits reduce brute-force attempts and expensive requests; they
cannot absorb a volumetric attack or stop requests before the web server accepts
them. Keep public traffic routed through Cloudflare Tunnel/proxied hostnames.
Review the live Cloudflare DDoS, WAF, bot, and edge rate-limit settings for the
account/plan. Apply tighter edge rules to authentication routes, and validate that
mobile clients, CORS preflights, payment integrations, and OAuth redirects work
before adding interactive challenges. Do not expose a separate public origin
route that bypasses the edge.

The repository already had Cloudflare Tunnel configuration. This change does not
modify or verify any live Cloudflare settings. The previously identified Telegram
authentication bypass remains a separate issue that rate limits do not fix.

## Validation

```sh
.venv/bin/python -m unittest discover -s tests -v
docker compose config --quiet
```

Tests use isolated in-memory counters and verify shared route budgets, independent
IP budgets, spoofed forwarding headers in direct mode, 429/Retry-After responses,
GET/preflight/health behavior, and that storage failure cannot execute the view.
The actual Flask factory was also checked with an isolated database URI: sensitive
endpoints resolve and the login route returns 429 after its test threshold.
Production Redis sharing and the public Cloudflare edge must be checked after
deployment; no live load or DDoS test was performed.

References:
- https://flask-limiter.readthedocs.io/en/stable/configuration.html
- https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/
