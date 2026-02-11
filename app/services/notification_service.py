from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.models.notification import Notification
from app.models.role import Role
from app.models.user import User


def _snippet(text: str | None, max_len: int = 60) -> str:
    s = (text or "").strip()
    if len(s) <= max_len:
        return s
    return s[: max_len - 3] + "..."


def format_time_ago(dt: datetime | None) -> str:
    if not dt:
        return ""
    now = datetime.utcnow()
    diff = now - dt
    seconds = diff.total_seconds()
    if seconds < 60:
        return "Just now"
    if seconds < 3600:
        return f"{int(seconds // 60)}m ago"
    if seconds < 86400:
        return f"{int(seconds // 3600)}h ago"
    if seconds < 172800:
        return "Yesterday"
    return dt.strftime("%b %d")


def serialize_notification(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "title": notification.title,
        "subtitle": notification.subtitle or "",
        "url": notification.url,
        "icon": notification.icon or "fas fa-bell",
        "level": notification.level or "info",
        "time": format_time_ago(notification.created_at),
        "unread": notification.read_at is None,
    }


def notify_user(
    *,
    user_id: int,
    kind: str,
    title: str,
    subtitle: str | None = None,
    url: str | None = None,
    icon: str = "fas fa-bell",
    level: str = "info",
    source_id: int | None = None,
    created_at: datetime | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        kind=kind,
        title=title,
        subtitle=subtitle,
        url=url,
        icon=icon,
        level=level,
        source_id=source_id,
        created_at=created_at or datetime.utcnow(),
    )
    db.session.add(n)
    return n


def notify_role(
    *,
    role_name: str,
    kind: str,
    title: str,
    subtitle: str | None = None,
    url: str | None = None,
    icon: str = "fas fa-bell",
    level: str = "info",
    source_id: int | None = None,
    created_at: datetime | None = None,
) -> int:
    role = Role.query.filter_by(name=role_name).first()
    if not role:
        return 0

    users = role.users.filter(User.is_active.is_(True)).all()
    for u in users:
        notify_user(
            user_id=u.id,
            kind=kind,
            title=title,
            subtitle=subtitle,
            url=url,
            icon=icon,
            level=level,
            source_id=source_id,
            created_at=created_at,
        )
    return len(users)


__all__ = [
    "_snippet",
    "format_time_ago",
    "serialize_notification",
    "notify_user",
    "notify_role",
]
