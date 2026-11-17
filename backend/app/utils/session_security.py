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


def _humanize_device_model(model_raw: str) -> str:
    clean = re.sub(r"\s+", " ", (model_raw or "").strip().strip('"\'')).strip()
    clean = re.sub(r"\s+Build/[^\s;)]*$", "", clean, flags=re.IGNORECASE).strip()
    if not clean or clean.upper() == "K" or len(clean) < 2:
        return ""
    upper = clean.upper()
    if upper.startswith("SM-"):
        if upper.startswith("SM-S928"):
            return "Samsung Galaxy S24 Ultra"
        if upper.startswith("SM-S926"):
            return "Samsung Galaxy S24+"
        if upper.startswith("SM-S921"):
            return "Samsung Galaxy S24"
        if upper.startswith("SM-S918"):
            return "Samsung Galaxy S23 Ultra"
        return f"Samsung {clean}"
    if upper.startswith("PIXEL"):
        return f"Google {clean}"
    if upper.startswith("CPH"):
        return f"OPPO {clean}"
    if upper.startswith("RMX"):
        return f"realme {clean}"
    if upper.startswith("V2") and len(clean) >= 5 and clean[2:].isalnum():
        return f"vivo {clean}"
    if re.match(r"^(?:M2|22|23|24)[0-9]{2}[A-Z0-9]+$", upper):
        return f"Xiaomi {clean}"
    return clean


def _detect_device_name(raw_ua: str, headers, device: str, os_name: str) -> str:
    header_model = (
        headers.get("X-Device-Name")
        or headers.get("X-Device-Model")
        or headers.get("Sec-CH-UA-Model")
        or ""
    )
    human_header = _humanize_device_model(header_model)
    if human_header:
        return re.sub(r"[^a-zA-Z0-9 _().+-]", "", human_header).strip()[:64]

    ua_lower = (raw_ua or "").lower()
    if os_name == "Flutter":
        if "iphone" in ua_lower:
            name = "iPhone App"
        elif "ipad" in ua_lower:
            name = "iPad App"
        elif "android" in ua_lower:
            name = "Android App"
        else:
            name = "Mobile App"
    elif "iphone" in ua_lower:
        name = "iPhone"
    elif "ipad" in ua_lower:
        name = "iPad"
    elif os_name == "macOS" or "macintosh" in ua_lower or "mac os" in ua_lower:
        name = "Mac / MacBook"
    elif os_name == "Windows" or "windows nt" in ua_lower:
        name = "Windows PC"
    elif "cros" in ua_lower:
        name = "Chromebook"
    elif os_name == "Android" or "android" in ua_lower:
        match = re.search(r"Android[^;)]*;\s*([^;)]+)", raw_ua or "", flags=re.IGNORECASE)
        parsed = _humanize_device_model(match.group(1)) if match else ""
        if parsed and parsed.lower() not in {"u", "wv", "mobile", "linux", "android"}:
            name = parsed
        else:
            name = "Android Tablet" if device == "tablet" else "Android Phone"
    elif os_name == "Linux" or "linux" in ua_lower:
        name = "Linux PC"
    elif device == "tablet":
        name = "Tablet"
    elif device == "mobile_phone":
        name = "Mobile Phone"
    else:
        name = "Desktop / Laptop"

    return re.sub(r"[^a-zA-Z0-9 _().+/-]", "", name).strip()[:64] or "Web Device"


def _login_device_metadata() -> dict[str, str]:
    """Classify the client without storing the full user-agent string."""
    raw_ua = request.headers.get("User-Agent") or ""
    user_agent = raw_ua.lower()
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

    device_name = _detect_device_name(raw_ua, request.headers, device, platform)
    from app.services.ip_geolocation import resolve_header_location, resolve_ip_location
    from app.utils.audit import get_client_ip

    location = resolve_header_location(request.headers) or resolve_ip_location(
        get_client_ip(), allow_network=False
    ) or ""

    return {
        "activity_id": uuid4().hex,
        "device": device,
        "device_name": device_name,
        "browser": browser,
        "os": platform,
        "location": location,
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
        sid = getattr(session, 'sid', None)
        sid_str = f" sid={sid}" if sid else ""
        dev_name_str = (
            f" device_name={device_metadata['device_name'].replace(' ', '_')}"
            if device_metadata.get('device_name')
            else ""
        )
        loc_str = (
            f" location={device_metadata['location'].replace(' ', '_')}"
            if device_metadata.get('location')
            else ""
        )
        try:
            from app.utils.audit import audit_log
            audit_log(
                "AUTH_SESSION_CREATED",
                target_user=getattr(user, "username", None),
                user_id=getattr(user, "id", None),
                detail=(
                    "Session initialized "
                    f"activity_id={device_metadata['activity_id']}"
                    f"{sid_str} "
                    f"device={device_metadata['device'].replace(' ', '_')} "
                    f"browser={device_metadata['browser'].replace(' ', '_')} "
                    f"os={device_metadata['os'].replace(' ', '_')} "
                    f"login_route={device_metadata['login_route']}"
                    f"{dev_name_str}{loc_str}"
                ),
            )
        except Exception:
            pass

    def logged_out(sender, user=None, **extra):
        act_id = session.get('_login_activity_id')
        if act_id:
            try:
                from app.services.login_activity import _ACTIVITY_CACHE_LOCK, _REVOKED_ACTIVITIES
                with _ACTIVITY_CACHE_LOCK:
                    _REVOKED_ACTIVITIES.add(act_id)
            except Exception:
                pass
        # regenerate() only acts on nonempty sessions; revoke the old SID first.
        session['_revoking'] = True
        app.session_interface.regenerate(session)
        session.clear()
        session['_remember'] = 'clear'
        g.session_revoked = True
        try:
            from app.utils.audit import audit_log
            act_str = f" activity_id={act_id}" if act_id else ""
            audit_log(
                "AUTH_LOGOUT",
                target_user=getattr(user, "username", None) if user else None,
                user_id=getattr(user, "id", None) if user else None,
                detail=f"User signed out{act_str}",
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

        cur_act = session.get('_login_activity_id')
        if cur_act:
            try:
                from app.services.login_activity import is_activity_revoked
                if is_activity_revoked(cur_act, user_id=session.get('_user_id')):
                    try:
                        from app.utils.audit import audit_log
                        audit_log(
                            "AUTH_SESSION_EXPIRED",
                            target_user=getattr(current_user, "username", None) if current_user.is_authenticated else None,
                            user_id=session.get('_user_id'),
                            detail=f"Session revoked by user activity_id={cur_act}",
                            status="REVOKED",
                            severity="WARNING",
                        )
                    except Exception:
                        pass
                    logout_user()
                    session.clear()
                    session['_remember'] = 'clear'
                    g.session_revoked = True
                    if request.path.startswith('/api/') or request.is_json:
                        return jsonify(error='This device session has been logged out.', code='session_revoked'), 401
                    from flask import flash, redirect, url_for
                    flash('This device was logged out from another session.', 'info')
                    return redirect(url_for('auth.login'))
            except Exception:
                pass

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
