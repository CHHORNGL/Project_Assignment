"""Revocable server-side sessions and authentication lifecycle controls."""
import hashlib
import hmac
import os
import re
import time
from uuid import uuid4

from cachelib.file import FileSystemCache
from flask import current_app, g, jsonify, request, session
from flask_login import current_user, logout_user, user_logged_in, user_logged_out
from flask_session import Session
from redis import Redis


def _login_device_metadata() -> dict[str, str]:
    """Classify the client without storing the full user-agent string."""
    user_agent = (request.headers.get("User-Agent") or "").lower()
    client_platform = (request.headers.get("X-Client-Platform") or "").lower()
    route = request.path or "-"

    if "tablet" in user_agent or "ipad" in user_agent:
        device = "tablet"
    elif client_platform == "flutter" or any(token in user_agent for token in ("iphone", "android", "mobile")):
        device = "mobile_phone"
    else:
        device = "laptop_computer"

    if client_platform == "flutter" or "dart" in user_agent:
        browser = "Mobile App"
    elif "edg/" in user_agent:
        browser = "Edge"
    elif "opr/" in user_agent or "opera" in user_agent:
        browser = "Opera"
    elif "chrome/" in user_agent or "crios/" in user_agent:
        browser = "Chrome"
    elif "firefox/" in user_agent or "fxios/" in user_agent:
        browser = "Firefox"
    elif "safari/" in user_agent:
        browser = "Safari"
    elif "curl/" in user_agent:
        browser = "API client"
    else:
        browser = "Unknown"

    if client_platform == "flutter":
        platform = "Flutter"
    elif "android" in user_agent:
        platform = "Android"
    elif "iphone" in user_agent or "ipad" in user_agent:
        platform = "iOS"
    elif "windows" in user_agent:
        platform = "Windows"
    elif "mac os" in user_agent or "macintosh" in user_agent:
        platform = "macOS"
    elif "linux" in user_agent:
        platform = "Linux"
    else:
        platform = "Unknown"

    return {
        "activity_id": uuid4().hex,
        "device": device,
        "browser": browser,
        "os": platform,
        "login_route": re.sub(r"[^a-zA-Z0-9_./-]", "", route)[:80] or "-",
    }


def credential_stamp(user):
    return hmac.new(
        current_app.secret_key.encode('utf-8'),
        (user.password_hash or '').encode('utf-8'), hashlib.sha256,
    ).hexdigest()


def init_server_sessions(app):
    if not app.secret_key:
        raise RuntimeError('SECRET_KEY must be configured for secure sessions.')
    backend = app.config['SESSION_TYPE']
    if backend == 'redis':
        app.config['SESSION_REDIS'] = Redis.from_url(
            app.config['SESSION_REDIS_URL'], socket_connect_timeout=3, socket_timeout=3,
        )
    elif backend == 'cachelib':
        # Local development only. Do not place session records in static/uploads.
        if app.config.get('SESSION_CACHELIB') is None:
            directory = os.path.join(app.instance_path, 'sessions')
            os.makedirs(directory, mode=0o700, exist_ok=True)
            app.config['SESSION_CACHELIB'] = FileSystemCache(
                cache_dir=directory, threshold=1000, mode=0o600,
            )
    else:
        raise RuntimeError('SESSION_TYPE must be redis or cachelib.')
    Session(app)


def register_session_security(app):
    def authenticated(sender, user, **extra):
        # Flask-Login has already set its authentication keys before this signal.
        auth = {key: session[key] for key in ('_user_id', '_fresh', '_id') if key in session}
        session.clear()
        session.update(auth)
        session.permanent = True
        session['_authenticated_at'] = session['_last_seen_at'] = time.time()
        session['_credential_stamp'] = credential_stamp(user)
        device_metadata = _login_device_metadata()
        session['_login_activity_id'] = device_metadata['activity_id']
        # Never allow a legacy remember cookie to recreate a revoked session.
        session['_remember'] = 'clear'
        app.session_interface.regenerate(session)
        try:
            from app.utils.audit import audit_log
            audit_log(
                "AUTH_SESSION_CREATED",
                target_user=getattr(user, "username", None),
                user_id=getattr(user, "id", None),
                detail=(
                    "Session initialized "
                    f"activity_id={device_metadata['activity_id']} "
                    f"device={device_metadata['device'].replace(' ', '_')} "
                    f"browser={device_metadata['browser'].replace(' ', '_')} "
                    f"os={device_metadata['os'].replace(' ', '_')} "
                    f"login_route={device_metadata['login_route']}"
                ),
            )
        except Exception:
            pass

    def logged_out(sender, user=None, **extra):
        # regenerate() only acts on nonempty sessions; revoke the old SID first.
        session['_revoking'] = True
        app.session_interface.regenerate(session)
        session.clear()
        session['_remember'] = 'clear'
        g.session_revoked = True
        try:
            from app.utils.audit import audit_log
            audit_log(
                "AUTH_LOGOUT",
                target_user=getattr(user, "username", None) if user else None,
                user_id=getattr(user, "id", None) if user else None,
                detail="User signed out",
            )
        except Exception:
            pass

    user_logged_in.connect(authenticated, sender=app, weak=False)
    user_logged_out.connect(logged_out, sender=app, weak=False)

    @app.before_request
    def check_session_lifetime():
        if request.endpoint in {'static', 'healthz'} or request.method == 'OPTIONS':
            return
        # Block automatic restoration from old remember-me cookies.
        if app.config.get('REMEMBER_COOKIE_NAME', 'remember_token') in request.cookies:
            session['_remember'] = 'clear'
        if '_user_id' not in session:
            return
        now = time.time()
        authenticated_at = session.get('_authenticated_at', 0)
        last_seen = session.get('_last_seen_at', 0)
        expired = (
            now - authenticated_at >= app.config['SESSION_ABSOLUTE_TIMEOUT_SECONDS']
            or now - last_seen >= app.config['SESSION_IDLE_TIMEOUT_SECONDS']
        )
        if not expired:
            expired = (
                not current_user.is_authenticated or not current_user.is_active
                or not hmac.compare_digest(
                    session.get('_credential_stamp', ''), credential_stamp(current_user)
                )
            )
        if expired:
            try:
                from app.utils.audit import audit_log
                audit_log(
                    "AUTH_SESSION_EXPIRED",
                    target_user=getattr(current_user, "username", None) if current_user.is_authenticated else None,
                    user_id=session.get('_user_id'),
                    detail="Session expired due to inactivity or credential invalidation",
                    status="EXPIRED",
                    severity="WARNING",
                )
            except Exception:
                pass
            logout_user()
            if request.path.startswith('/api/') or request.is_json:
                return jsonify(error='Session expired. Please log in again.', code='session_expired'), 401
            return app.login_manager.unauthorized()
        session['_last_seen_at'] = now

    @app.after_request
    def prevent_private_caching(response):
        if ('_user_id' in session or getattr(g, 'session_revoked', False)
                or request.blueprint in {'auth', 'staff', 'api'}):
            response.headers['Cache-Control'] = 'no-store, private'
            response.headers['Pragma'] = 'no-cache'
        return response
