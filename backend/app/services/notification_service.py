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
    return {
        "id": notification.id,
        "title": notification.title,
        "subtitle": notification.subtitle or "",
        "url": normalize_notification_url(notification.url),
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


__all__ = [
    "_snippet",
    "format_time_ago",
    "serialize_notification",
    "notify_user",
    "notify_role",
]
