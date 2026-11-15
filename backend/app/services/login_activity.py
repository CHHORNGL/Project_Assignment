"""Helpers for presenting a user's successful login sessions and session revocation."""

import re
from datetime import datetime, timezone
from flask import current_app, has_request_context, request, session
from flask_login import current_user

from app.models.audit_log import AuditLog


_DETAIL_VALUE = re.compile(r"(?:^|\s)([a-z_]+)=([^\s]+)")

_REVOKED_ACTIVITIES: set[str] = set()
_KNOWN_VALID_ACTIVITIES: set[str] = set()


def _detail_values(detail: str | None) -> dict[str, str]:
    if not detail:
        return {}
    return {key: value for key, value in _DETAIL_VALUE.findall(detail)}


def _format_device_type(device_raw: str, platform_raw: str) -> str:
    dev = (device_raw or "").lower()
    plat = (platform_raw or "").lower()

    if "tablet" in dev or "ipad" in dev or "ipad" in plat:
        return "Tablet"
    elif "mobile" in dev or "phone" in dev or plat in ("ios", "android", "flutter"):
        return "Mobile Phone"
    elif "desktop" in dev or "computer" in dev or "laptop" in dev or plat in ("macos", "windows", "linux"):
        return "Laptop / Computer"
    return dev.replace("_", " ").title() or "Laptop / Computer"


def is_activity_revoked(activity_id: str | None, user_id: int | None = None) -> bool:
    """Check if a session activity_id has been revoked or logged out."""
    if not activity_id:
        return False
    if activity_id in _REVOKED_ACTIVITIES:
        return True
    if activity_id in _KNOWN_VALID_ACTIVITIES:
        return False

    # Check Redis if available
    try:
        if has_request_context():
            redis_client = current_app.config.get("SESSION_REDIS")
            if redis_client:
                if redis_client.get(f"agri:revoked_activity:{activity_id}"):
                    _REVOKED_ACTIVITIES.add(activity_id)
                    return True
    except Exception:
        pass

    # Check database AuditLog
    try:
        query = AuditLog.query.filter(
            AuditLog.action.in_(["AUTH_SESSION_REVOKED", "AUTH_LOGOUT"]),
            AuditLog.detail.like(f"%activity_id={activity_id}%"),
        )
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        match = query.first()
        if match:
            _REVOKED_ACTIVITIES.add(activity_id)
            return True
        _KNOWN_VALID_ACTIVITIES.add(activity_id)
    except Exception:
        pass

    return False


def revoke_login_activity(user_id: int, activity_id: str, *, actor_username: str | None = None) -> bool:
    """Revoke a specific login session for a user."""
    if not activity_id:
        return False

    # Find the audit log that created this session
    row = AuditLog.query.filter(
        AuditLog.user_id == user_id,
        AuditLog.action == "AUTH_SESSION_CREATED",
        AuditLog.detail.like(f"%activity_id={activity_id}%"),
    ).first()

    # Check if current session matches
    is_current = False
    try:
        if (
            has_request_context()
            and session.get("_login_activity_id") == activity_id
            and getattr(current_user, "id", None) == user_id
        ):
            is_current = True
    except Exception:
        pass

    if not row and not is_current:
        return False

    _REVOKED_ACTIVITIES.add(activity_id)
    _KNOWN_VALID_ACTIVITIES.discard(activity_id)

    # Invalidate in Redis
    try:
        if has_request_context():
            redis_client = current_app.config.get("SESSION_REDIS")
            if redis_client:
                redis_client.set(f"agri:revoked_activity:{activity_id}", "1", ex=15 * 86400)
    except Exception:
        pass

    # Invalidate session storage (Redis / Cachelib) if sid is known
    sid = None
    if row:
        vals = _detail_values(row.detail)
        sid = vals.get("sid")
    if not sid and is_current:
        try:
            sid = getattr(session, "sid", None)
        except Exception:
            pass

    if sid and has_request_context():
        try:
            prefix = current_app.config.get("SESSION_KEY_PREFIX", "agri:session:")
            redis_client = current_app.config.get("SESSION_REDIS")
            if redis_client:
                redis_client.delete(f"{prefix}{sid}")
            cachelib = current_app.config.get("SESSION_CACHELIB")
            if cachelib:
                cachelib.delete(f"{prefix}{sid}")
                cachelib.delete(sid)
        except Exception:
            pass

    # Record revocation in AuditLog
    try:
        from app.utils.audit import audit_log
        audit_log(
            "AUTH_SESSION_REVOKED",
            target_user=actor_username or getattr(current_user, "username", None),
            user_id=user_id,
            detail=f"Session revoked activity_id={activity_id}" + (f" sid={sid}" if sid else ""),
        )
    except Exception:
        pass

    return True


def revoke_all_other_sessions(user_id: int, current_activity_id: str | None = None, *, actor_username: str | None = None) -> int:
    """Revoke all sessions for a user except the current active session."""
    rows = (
        AuditLog.query
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.action == "AUTH_SESSION_CREATED",
        )
        .all()
    )
    revoked_count = 0
    seen_ids = set()
    for row in rows:
        vals = _detail_values(row.detail)
        aid = vals.get("activity_id")
        if not aid or aid == current_activity_id or aid in seen_ids:
            continue
        seen_ids.add(aid)
        if not is_activity_revoked(aid, user_id=user_id):
            if revoke_login_activity(user_id, aid, actor_username=actor_username):
                revoked_count += 1
    return revoked_count


def list_login_activity(
    user_id: int,
    *,
    current_activity_id: str | None = None,
    limit: int = 50,
    include_revoked: bool = False,
) -> list[dict]:
    """Return active login sessions for one user, hiding logged-out/revoked devices."""
    limit = max(1, min(int(limit or 50), 100))
    rows = (
        AuditLog.query
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.action == "AUTH_SESSION_CREATED",
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    # Query revoked/logout events for this user
    revoked_events = (
        AuditLog.query
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.action.in_(["AUTH_SESSION_REVOKED", "AUTH_LOGOUT"]),
        )
        .all()
    )
    revoked_ids = set(_REVOKED_ACTIVITIES)
    for rev in revoked_events:
        vals = _detail_values(rev.detail)
        aid = vals.get("activity_id")
        if aid:
            revoked_ids.add(aid)

    raw_items = []
    seen_activity_ids = set()
    for row in rows:
        values = _detail_values(row.detail)
        activity_id = values.get("activity_id")
        if not activity_id or activity_id in seen_activity_ids:
            continue
        seen_activity_ids.add(activity_id)

        device_type = _format_device_type(values.get("device", ""), values.get("os", ""))
        browser = values.get("browser", "Unknown").replace("_", " ")
        platform = values.get("os", "Unknown").replace("_", " ")

        is_current = bool(activity_id and activity_id == current_activity_id)
        is_rev = bool(not is_current and (activity_id in revoked_ids or is_activity_revoked(activity_id, user_id=user_id)))

        # Hide logged-out / revoked devices unless explicitly requested
        if not include_revoked and is_rev:
            continue

        raw_items.append({
            "id": row.id,
            "activity_id": activity_id,
            "device_type": device_type,
            "browser": browser,
            "platform": platform,
            "route": values.get("login_route", "-"),
            "ip_address": values.get("ip", "-"),
            "created_at": row.created_at.isoformat() + "Z" if row.created_at else None,
            "current": is_current,
            "revoked": is_rev,
        })

    # Deduplicate active devices by (device_type, browser, platform) so multiple
    # historical logins from the same device don't clutter the active list.
    activities = []
    seen_signatures = set()

    # Prioritize current device first
    current_item = next((item for item in raw_items if item.get("current")), None)
    if current_item:
        sig = (current_item["device_type"], current_item["browser"], current_item["platform"])
        seen_signatures.add(sig)
        activities.append(current_item)

    for item in raw_items:
        if item.get("current"):
            continue
        sig = (item["device_type"], item["browser"], item["platform"])
        if sig not in seen_signatures:
            seen_signatures.add(sig)
            activities.append(item)

    has_current = any(act.get("current") for act in activities)
    if not has_current:
        try:
            if (
                has_request_context()
                and current_user
                and getattr(current_user, "is_authenticated", False)
                and getattr(current_user, "id", None) == user_id
            ):
                from app.utils.session_security import _login_device_metadata

                meta = _login_device_metadata()
                cur_id = session.get("_login_activity_id") or meta["activity_id"]
                session["_login_activity_id"] = cur_id
                sid = getattr(session, "sid", None)
                sid_str = f" sid={sid}" if sid else ""

                existing = next((a for a in activities if a.get("activity_id") == cur_id), None)
                if existing:
                    existing["current"] = True
                    existing["revoked"] = False
                else:
                    try:
                        from app.utils.audit import audit_log
                        audit_log(
                            "AUTH_SESSION_CREATED",
                            target_user=getattr(current_user, "username", None),
                            user_id=user_id,
                            detail=(
                                "Session initialized "
                                f"activity_id={cur_id}"
                                f"{sid_str} "
                                f"device={meta['device'].replace(' ', '_')} "
                                f"browser={meta['browser'].replace(' ', '_')} "
                                f"os={meta['os'].replace(' ', '_')} "
                                f"login_route={meta['login_route']}"
                            ),
                        )
                    except Exception:
                        pass

                    new_current = {
                        "id": 0,
                        "activity_id": cur_id,
                        "device_type": _format_device_type(meta.get("device", ""), meta.get("os", "")),
                        "browser": meta["browser"].replace("_", " "),
                        "platform": meta["os"].replace("_", " "),
                        "route": meta["login_route"],
                        "ip_address": getattr(request, "remote_addr", "-") or "-",
                        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
                        "current": True,
                        "revoked": False,
                    }
                    cur_sig = (new_current["device_type"], new_current["browser"], new_current["platform"])
                    activities = [a for a in activities if (a["device_type"], a["browser"], a["platform"]) != cur_sig]
                    activities.insert(0, new_current)
        except Exception:
            pass

    return activities
