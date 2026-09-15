# HTTP security headers

The Flask application registers `app/utils/security_headers.py` globally. Headers
apply to HTML, API, redirects, errors, and static files served through Flask.
Existing explicit endpoint policies are preserved.

| Header | Default behavior |
| --- | --- |
| X-Content-Type-Options | `nosniff`: use the declared MIME type |
| X-Frame-Options | `SAMEORIGIN`: prevent framing by other origins |
| Content-Security-Policy | `object-src 'none'; base-uri 'self'; frame-ancestors 'self'` |
| Referrer-Policy | `strict-origin-when-cross-origin`: omit path/query on cross-origin requests |
| Permissions-Policy | Camera, microphone, geolocation, and passkeys limited to self; accelerometer, gyroscope, magnetometer, and USB disabled |
| X-XSS-Protection | `0`: disable obsolete browser XSS filtering |
| Strict-Transport-Security | `max-age=31536000`, on HTTPS responses only |

The CSP is an enforced baseline, not a complete script/XSS policy. It deliberately
has no `default-src` or `script-src` restriction yet because the existing pages
use inline scripts, event handlers, third-party CDNs, and PayPal. A stricter policy
requires migrating inline code to nonces/external files and validating all page
integrations. Google Maps and PayPal child frames remain available; frame-ancestors
controls who embeds this application, not which frames it embeds.

HSTS uses the HTTPS scheme recognized by the existing ProxyFix configuration.
Production ingress must overwrite forwarded headers and prevent untrusted direct
access to the backend. HSTS does not redirect the first HTTP request: configure
HTTP-to-HTTPS redirection at the TLS proxy. Local HTTP development gets no HSTS.
The policy does not opt subdomains into HSTS or request browser preloading.

These headers cover responses served by Flask. A separately hosted frontend or
static assets served directly by a CDN/proxy need equivalent headers there.
Restrictive COEP/CORP/COOP policies are not added because cross-origin assets,
frontend/backend deployment, and authentication/payment popups need their own audit.
These changes do not restrict the application's existing CORS allowlist.

Run tests from the project root:

```sh
.venv/bin/python -m unittest discover -s tests -v
```

After deployment, inspect the actual public HTTPS response in browser DevTools
(Network → response headers) to confirm that the proxy preserves these headers.

Reference: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
