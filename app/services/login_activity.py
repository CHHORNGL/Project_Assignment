"""Helpers for presenting a user's successful login sessions."""

import re

from app.models.audit_log import AuditLog


_DETAIL_VALUE = re.compile(r"(?:^|\s)([a-z_]+)=([^\s]+)")


def _detail_values(detail: str | None) -> dict[str, str]:
    if not detail:
        return {}
    return {key: value for key, value in _DETAIL_VALUE.findall(detail)}


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
        device_type = values.get("device", "unknown").replace("_", " ").title()
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
    return activities
