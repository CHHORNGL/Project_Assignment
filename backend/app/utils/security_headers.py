"""Security response headers shared by every Flask endpoint."""

from flask import request


def register_security_headers(app):
    @app.after_request
    def add_security_headers(response):
        # Keep an endpoint's explicitly stricter policy when it supplies one.
        headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
            "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
            # Baseline CSP: block third-party embedding and plugin execution.
            "Content-Security-Policy": (
                "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
            ),
            # Preserve crop photos, voice chat, weather location, and passkeys.
            "Permissions-Policy": (
                "camera=(self), microphone=(self), geolocation=(self), "
                "publickey-credentials-get=(self), publickey-credentials-create=(self), "
                "accelerometer=(), gyroscope=(), magnetometer=(), usb=()"
            ),
            # Request Chromium Client Hints so device model names resolve cleanly.
            "Accept-CH": "Sec-CH-UA-Model, Sec-CH-UA-Platform",
            # Disable the obsolete browser XSS auditor; use CSP and escaping.
            "X-XSS-Protection": "0",
        }
        for name, value in headers.items():
            response.headers.setdefault(name, value)

        # ProxyFix supplies the external scheme behind the trusted TLS proxy.
        # Do not force local HTTP development onto HTTPS or affect subdomains.
        if request.is_secure:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000"
            )
        return response
