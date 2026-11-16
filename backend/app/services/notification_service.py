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


def normalize_notification_url(raw_url: str | None) -> str | None:
    if not raw_url:
        return None
    url = str(raw_url).strip()
    if not url or url.lower() in ("#", "none", "null", "undefined"):
        return None

    # Handle mobile help center and special known mobile pages
    if url in ("mobile-help-center", "/mobile-help-center", "mobile-help-center/"):
        return "/farmer/dashboard"

    # Handle full URLs (e.g. cloudflare tunnels, external domains) by extracting local path
    if url.startswith(("http://", "https://")):
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            path = parsed.path or "/"
            if parsed.query:
                path = f"{path}?{parsed.query}"
            return path
        except Exception:
            return url

    # Ensure leading slash for internal paths
    if not url.startswith("/"):
        url = "/" + url

    return url


def serialize_notification(notification: Notification) -> dict:
    normalized_url = normalize_notification_url(notification.url)
    subtitle = notification.subtitle or ""
    is_read = notification.read_at is not None
    created_at = notification.created_at
    if created_at is not None:
        created_iso = (
            created_at.isoformat() + "Z"
            if created_at.tzinfo is None
            else created_at.isoformat()
        )
    else:
        created_iso = None
    return {
        "id": notification.id,
        "kind": notification.kind or "system",
        "title": notification.title,
        "subtitle": subtitle,
        "message": subtitle,
        "url": normalized_url,
        "link": normalized_url,
        "icon": notification.icon or "fas fa-bell",
        "level": notification.level or "info",
        "time": format_time_ago(created_at),
        "created_at": created_iso,
        "unread": not is_read,
        "is_read": is_read,
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
    url = normalize_notification_url(url)
    if source_id is not None:
        existing = Notification.query.filter_by(
            user_id=user_id, kind=kind, source_id=source_id
        ).first()
        if existing:
            existing.title = title
            existing.subtitle = subtitle
            existing.url = url
            existing.icon = icon
            existing.level = level
            existing.created_at = created_at or datetime.utcnow()
            existing.read_at = None
            return existing

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
    url = normalize_notification_url(url)
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


def get_unread_notification_count(user_id: int) -> int:
    """Return total unread notification count for a user."""
    return (
        Notification.query.filter(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
        ).count()
    )


def mark_notifications_seen(
    user_id: int,
    ids: list | tuple | None = None,
    *,
    read_at: datetime | None = None,
) -> tuple[int, int]:
    """Mark all or selected unread notifications read and return (updated, unread_count)."""
    query = Notification.query.filter(
        Notification.user_id == user_id,
        Notification.read_at.is_(None),
    )
    if ids is not None:
        id_list: list[int] = []
        if isinstance(ids, (list, tuple)):
            for val in ids:
                try:
                    id_list.append(int(val))
                except (TypeError, ValueError):
                    continue
        if len(ids) > 0 if isinstance(ids, (list, tuple)) else True:
            if not id_list:
                return 0, get_unread_notification_count(user_id)
            query = query.filter(Notification.id.in_(id_list))

    updated = query.update({"read_at": read_at or datetime.utcnow()}, synchronize_session=False)
    db.session.commit()
    return updated, get_unread_notification_count(user_id)


__all__ = [
    "_snippet",
    "format_time_ago",
    "get_unread_notification_count",
    "mark_notifications_seen",
    "serialize_notification",
    "notify_user",
    "notify_role",
]
