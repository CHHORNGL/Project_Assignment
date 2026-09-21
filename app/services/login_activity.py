"""Helpers for presenting a user's successful login sessions."""

import re

from app.models.audit_log import AuditLog


_DETAIL_VALUE = re.compile(r"(?:^|\s)([a-z_]+)=([^\s]+)")


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


def list_login_activity(user_id: int, *, current_activity_id: str | None = None, limit: int = 50) -> list[dict]:
    """Return recent successful sessions for one user from the audit trail."""
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

    activities = []
    for row in rows:
        values = _detail_values(row.detail)
        activity_id = values.get("activity_id")
        device_type = _format_device_type(values.get("device", ""), values.get("os", ""))
        activities.append({
            "id": row.id,
            "activity_id": activity_id,
            "device_type": device_type,
            "browser": values.get("browser", "Unknown").replace("_", " "),
            "platform": values.get("os", "Unknown").replace("_", " "),
            "route": values.get("login_route", "-"),
            "ip_address": values.get("ip", "-"),
            "created_at": row.created_at.isoformat() + "Z" if row.created_at else None,
            "current": bool(activity_id and activity_id == current_activity_id),
        })

    has_current = any(act.get("current") for act in activities)
    if not has_current:
        try:
            from flask import has_request_context, request, session
            from flask_login import current_user
            if (
                has_request_context()
                and current_user
                and getattr(current_user, "is_authenticated", False)
                and getattr(current_user, "id", None) == user_id
            ):
                from datetime import datetime, timezone
                from app.utils.session_security import _login_device_metadata

                meta = _login_device_metadata()
                cur_id = session.get("_login_activity_id") or meta["activity_id"]
                session["_login_activity_id"] = cur_id

                existing = next((a for a in activities if a.get("activity_id") == cur_id), None)
                if existing:
                    existing["current"] = True
                else:
                    try:
                        from app.utils.audit import audit_log
                        audit_log(
                            "AUTH_SESSION_CREATED",
                            target_user=getattr(current_user, "username", None),
                            user_id=user_id,
                            detail=(
                                "Session initialized "
                                f"activity_id={cur_id} "
                                f"device={meta['device'].replace(' ', '_')} "
                                f"browser={meta['browser'].replace(' ', '_')} "
                                f"os={meta['os'].replace(' ', '_')} "
                                f"login_route={meta['login_route']}"
                            ),
                        )
                    except Exception:
                        pass

                    activities.insert(0, {
                        "id": 0,
                        "activity_id": cur_id,
                        "device_type": _format_device_type(meta.get("device", ""), meta.get("os", "")),
                        "browser": meta["browser"].replace("_", " "),
                        "platform": meta["os"].replace("_", " "),
                        "route": meta["login_route"],
                        "ip_address": getattr(request, "remote_addr", "-") or "-",
                        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
                        "current": True,
                    })
        except Exception:
            pass

    return activities
