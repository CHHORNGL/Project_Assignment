"""Gunicorn runtime configuration hiding server headers and tuning Render worker lifecycle."""

import os

import gunicorn
import gunicorn.http.wsgi as gunicorn_wsgi

# Mask the Gunicorn version banner so upstream proxies do not leak server details.
gunicorn.SERVER = "webserver"
gunicorn_wsgi.SERVER = "webserver"

# Sized for Render Starter instances while allowing concurrent I/O across
# threads and aligning keepalive/timeout with upstream reverse proxies and HF inference.
worker_class = (os.getenv("GUNICORN_WORKER_CLASS") or "gthread").strip() or "gthread"
workers = max(1, int(os.getenv("WEB_CONCURRENCY", "2")))
threads = max(1, int(os.getenv("GUNICORN_THREADS", "6")))
timeout = max(30, int(os.getenv("GUNICORN_TIMEOUT", "180")))
graceful_timeout = 30
keepalive = 65
max_requests = max(0, int(os.getenv("GUNICORN_MAX_REQUESTS", "1000")))
max_requests_jitter = 100
forwarded_allow_ips = os.getenv("GUNICORN_FORWARDED_ALLOW_IPS", "*")
