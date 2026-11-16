"""Shared Live Chat routing, inbox aggregation, and messaging helpers."""
from __future__ import annotations

from datetime import datetime, timedelta
import os
from typing import Any

from flask import current_app, request, url_for

from app.extensions import db
from app.models import AdminChatMessage, Role, User
from app.models.notification import Notification
from app.services.notification_service import _snippet, notify_role, notify_user
from app.utils.input_validation import support_message_fields
from app.utils.support_attachments import SupportAttachmentError, save_support_attachment
from app.utils.support_chat_realtime import (
    clear_typing,
    is_typing,
    serialize_chat_message,
    set_typing,
)


def normalize_support_target(raw: str | None) -> str:
    return "expert" if str(raw or "").strip().lower() == "expert" else "admin"


def primary_role_label(user: User) -> str:
    roles = [getattr(r, "name", "") for r in getattr(user, "roles", [])]
    for candidate in ("admin", "expert", "farmer"):
        if candidate in roles:
            return candidate
    return roles[0] if roles else "member"


def resolve_role_users(role_name: str) -> list[User]:
    """Return active users holding role_name, preferring non-test staff accounts first."""
    role = normalize_support_target(role_name)
    users = (
        User.query.filter(
            User.is_active.is_(True),
            User.roles.any(Role.name == role),
        )
        .order_by(User.id.asc())
        .all()
    )
    if role == "expert" and len(users) > 1:
        non_admin_experts = [
            u
            for u in users
            if not any(getattr(r, "name", "") == "admin" for r in getattr(u, "roles", []))
        ]
        if non_admin_experts:
            users = non_admin_experts

    users.sort(
        key=lambda u: (str(getattr(u, "username", "") or "").lower().startswith("test"), u.id)
    )
    return users


def resolve_farmer_support_partner(
    farmer_id: int,
    target: str = "admin",
    recipient_id: int | None = None,
) -> tuple[str, User | None, list[User]]:
    """Resolve the active Admin or Expert partner for a farmer live-support channel."""
    normalized_target = normalize_support_target(target)
    candidates = resolve_role_users(normalized_target)
    if not candidates:
        return normalized_target, None, []

    by_id = {u.id: u for u in candidates}
    if recipient_id and recipient_id in by_id:
        return normalized_target, by_id[recipient_id], candidates

    candidate_ids = set(by_id.keys())
    recent = (
        AdminChatMessage.query.filter(
            db.or_(
                db.and_(
                    AdminChatMessage.sender_id == farmer_id,
                    AdminChatMessage.receiver_id.in_(candidate_ids),
                ),
                db.and_(
                    AdminChatMessage.sender_id.in_(candidate_ids),
                    AdminChatMessage.receiver_id == farmer_id,
                ),
            )
        )
        .order_by(AdminChatMessage.id.desc())
        .first()
    )
    if recent is not None:
        partner_id = recent.receiver_id if recent.sender_id == farmer_id else recent.sender_id
        if partner_id in by_id:
            return normalized_target, by_id[partner_id], candidates

    return normalized_target, candidates[0], candidates


def farmer_channel_messages_query(
    farmer_id: int,
    eligible_ids: set[int],
    cutoff: datetime,
    recipient_id: int | None = None,
):
    """Build a 24h message query for a farmer scoped to one staff role or specific staff member."""
    if not eligible_ids:
        return AdminChatMessage.query.filter(AdminChatMessage.id == -1)

    target_ids = {recipient_id} if (recipient_id and recipient_id in eligible_ids) else eligible_ids
    return AdminChatMessage.query.filter(
        AdminChatMessage.created_at >= cutoff,
        db.or_(
            db.and_(
                AdminChatMessage.sender_id == farmer_id,
                AdminChatMessage.receiver_id.in_(target_ids),
            ),
            db.and_(
                AdminChatMessage.sender_id.in_(target_ids),
                AdminChatMessage.receiver_id == farmer_id,
            ),
        ),
    )


def _serialize_staff_recipient(user: User, role_label: str) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": getattr(user, "full_name", None) or user.username,
        "username": user.username,
        "role": role_label,
        "avatarUrl": url_for("user.avatar", user_id=user.id),
    }


def farmer_support_channels_summary(farmer_id: int) -> dict[str, Any]:
    """Summarize available Admin & Expert live chat recipients and unread counts for a farmer."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    summary: dict[str, Any] = {}

    for channel in ("admin", "expert"):
        target, default_partner, candidates = resolve_farmer_support_partner(
            farmer_id, target=channel
        )
        eligible_ids = {u.id for u in candidates}
        if eligible_ids:
            unread_count = (
                AdminChatMessage.query.filter(
                    AdminChatMessage.created_at >= cutoff,
                    AdminChatMessage.sender_id.in_(eligible_ids),
                    AdminChatMessage.receiver_id == farmer_id,
                    AdminChatMessage.is_read.is_(False),
                ).count()
            )
            last_msg = (
                farmer_channel_messages_query(farmer_id, eligible_ids, cutoff)
                .order_by(AdminChatMessage.id.desc())
                .first()
            )
        else:
            unread_count = 0
            last_msg = None

        summary[target] = {
            "available": bool(candidates),
            "unreadCount": int(unread_count or 0),
            "defaultRecipientId": default_partner.id if default_partner else None,
            "recipients": [_serialize_staff_recipient(u, target) for u in candidates],
            "lastMessage": (
                last_msg.message or f"[{last_msg.attachment_type or 'attachment'}]"
                if last_msg
                else ""
            ),
            "lastTime": last_msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if last_msg else None,
        }

    return summary


def load_staff_inbox_users(
    staff_role: str,
    current_user_id: int,
) -> tuple[list[User], set[int]]:
    """Return unique partners & staff IDs for an Admin or Expert support inbox."""
    staff_users = resolve_role_users(staff_role)
    staff_ids = {u.id for u in staff_users}
    staff_ids.add(current_user_id)

    rows = (
        db.session.query(AdminChatMessage.sender_id, AdminChatMessage.receiver_id)
        .filter(
            db.or_(
                AdminChatMessage.sender_id.in_(staff_ids),
                AdminChatMessage.receiver_id.in_(staff_ids),
            )
        )
        .all()
    )
    partner_ids: set[int] = set()
    for sender_id, receiver_id in rows:
        partner_ids.add(sender_id)
        partner_ids.add(receiver_id)
    partner_ids.update(staff_ids)

    chat_users = User.query.filter(User.id.in_(partner_ids)).all() if partner_ids else []
    user_dict = {u.id: u for u in chat_users}
    for u in staff_users:
        user_dict[u.id] = u
    return list(user_dict.values()), staff_ids


def staff_unread_counts(staff_ids: set[int], current_user_id: int) -> dict[int, int]:
    unread_rows = (
        db.session.query(
            AdminChatMessage.sender_id,
            AdminChatMessage.receiver_id,
            db.func.count(AdminChatMessage.id),
        )
        .filter(
            AdminChatMessage.is_read.is_(False),
            db.or_(
                AdminChatMessage.sender_id.in_(staff_ids),
                AdminChatMessage.receiver_id.in_(staff_ids),
            ),
        )
        .group_by(AdminChatMessage.sender_id, AdminChatMessage.receiver_id)
        .all()
    )
    counts: dict[int, int] = {}
    for sender_id, receiver_id, qty in unread_rows:
        if sender_id == current_user_id:
            continue
        if sender_id in staff_ids and receiver_id != current_user_id:
            continue
        counts[sender_id] = counts.get(sender_id, 0) + int(qty or 0)
    return counts


def staff_latest_message_map(staff_ids: set[int], current_user_id: int) -> dict[int, AdminChatMessage]:
    recent = (
        db.session.query(AdminChatMessage)
        .filter(
            db.or_(
                AdminChatMessage.sender_id.in_(staff_ids),
                AdminChatMessage.receiver_id.in_(staff_ids),
            )
        )
        .order_by(AdminChatMessage.id.desc())
        .limit(400)
        .all()
    )
    latest_map: dict[int, AdminChatMessage] = {}
    for msg in recent:
        sender_is_staff = msg.sender_id in staff_ids
        receiver_is_staff = msg.receiver_id in staff_ids

        if sender_is_staff and receiver_is_staff:
            if msg.sender_id != current_user_id and msg.receiver_id != current_user_id:
                continue
            partner_id = msg.receiver_id if msg.sender_id == current_user_id else msg.sender_id
        elif not sender_is_staff:
            partner_id = msg.sender_id
        else:
            partner_id = msg.receiver_id

        if partner_id not in latest_map:
            latest_map[partner_id] = msg
    return latest_map


def staff_conversations_payload(staff_role: str, current_user_id: int) -> dict[str, Any]:
    final_users, staff_ids = load_staff_inbox_users(staff_role, current_user_id)
    unread_counts = staff_unread_counts(staff_ids, current_user_id)
    latest_map = staff_latest_message_map(staff_ids, current_user_id)

    result = []
    total_unread = 0
    for u in final_users:
        if u.id == current_user_id:
            continue
        cnt = unread_counts.get(u.id, 0)
        total_unread += cnt
        last_m = latest_map.get(u.id)
        last_text = ""
        last_time = ""
        last_sender_id = None
        if last_m:
            last_text = last_m.message or f"[{last_m.attachment_type or 'attachment'}]"
            last_time = last_m.created_at.strftime("%Y-%m-%d %H:%M:%S")
            last_sender_id = last_m.sender_id

        result.append(
            {
                "id": u.id,
                "name": u.full_name or u.username,
                "username": u.username,
                "role": primary_role_label(u),
                "avatar_url": url_for("user.avatar", user_id=u.id),
                "unread_count": cnt,
                "last_message": last_text,
                "last_message_time": last_time,
                "last_sender_id": last_sender_id,
                "is_typing": is_typing(u.id, current_user_id),
            }
        )

    result.sort(
        key=lambda x: (x["unread_count"] > 0, x["last_message_time"]),
        reverse=True,
    )
    return {"conversations": result, "total_unread": total_unread}


def decorate_staff_inbox_users(staff_role: str, current_user_id: int) -> list[User]:
    final_users, staff_ids = load_staff_inbox_users(staff_role, current_user_id)
    unread_counts = staff_unread_counts(staff_ids, current_user_id)
    latest_map = staff_latest_message_map(staff_ids, current_user_id)

    for u in final_users:
        u.unread_support_count = unread_counts.get(u.id, 0)
        last_msg = latest_map.get(u.id)
        u.latest_support_time = last_msg.created_at if last_msg else None
        if last_msg:
            u.latest_support_preview = (
                last_msg.message or f"[{last_msg.attachment_type or 'attachment'}]"
            )
        else:
            u.latest_support_preview = ""
        u.support_role = primary_role_label(u)

    final_users.sort(
        key=lambda u: (
            (u.unread_support_count or 0) > 0,
            u.latest_support_time or datetime.min,
        ),
        reverse=True,
    )
    return final_users


def staff_thread_messages_payload(
    *,
    staff_role: str,
    current_user_id: int,
    partner_id: int,
    after_id: int | None,
    envelope: bool,
) -> dict[str, Any] | list[dict[str, Any]]:
    staff_ids = {u.id for u in resolve_role_users(staff_role)}
    staff_ids.add(current_user_id)
    target_user = db.session.get(User, partner_id)
    is_target_staff = (
        any(r.name == staff_role for r in target_user.roles) if target_user else False
    )

    if is_target_staff:
        base_query = AdminChatMessage.query.filter(
            db.or_(
                db.and_(
                    AdminChatMessage.sender_id == current_user_id,
                    AdminChatMessage.receiver_id == partner_id,
                ),
                db.and_(
                    AdminChatMessage.sender_id == partner_id,
                    AdminChatMessage.receiver_id == current_user_id,
                ),
            )
        )
    else:
        base_query = AdminChatMessage.query.filter(
            db.or_(
                db.and_(
                    AdminChatMessage.sender_id == partner_id,
                    AdminChatMessage.receiver_id.in_(staff_ids),
                ),
                db.and_(
                    AdminChatMessage.sender_id.in_(staff_ids),
                    AdminChatMessage.receiver_id == partner_id,
                ),
            )
        )

    unread_ids = [
        row[0]
        for row in base_query.with_entities(AdminChatMessage.id)
        .filter(
            AdminChatMessage.sender_id == partner_id,
            AdminChatMessage.is_read.is_(False),
            *(
                [AdminChatMessage.receiver_id == current_user_id]
                if is_target_staff
                else []
            ),
        )
        .all()
    ]
    if unread_ids:
        AdminChatMessage.query.filter(AdminChatMessage.id.in_(unread_ids)).update(
            {AdminChatMessage.is_read: True}, synchronize_session=False
        )
        Notification.query.filter(
            Notification.user_id == current_user_id,
            Notification.kind == "support_chat",
            Notification.source_id.in_([partner_id] + unread_ids),
            Notification.read_at.is_(None),
        ).update({Notification.read_at: datetime.utcnow()}, synchronize_session=False)
        db.session.commit()

    query = base_query
    if after_id is not None and after_id > 0:
        query = query.filter(AdminChatMessage.id > after_id)

    messages = query.order_by(AdminChatMessage.id.asc()).all()
    serialized = [serialize_chat_message(msg) for msg in messages]

    if envelope:
        read_ids = [
            row[0]
            for row in base_query.with_entities(AdminChatMessage.id)
            .filter(
                AdminChatMessage.sender_id == current_user_id,
                AdminChatMessage.is_read.is_(True),
            )
            .all()
        ]
        return {
            "messages": serialized,
            "read_ids": read_ids,
            "partner_typing": is_typing(partner_id, current_user_id),
        }

    return serialized


def staff_send_support_message(
    *,
    staff_role: str,
    current_user: User,
    partner_id: int,
    data: dict[str, Any] | None,
) -> tuple[dict[str, Any], int]:
    message_text, attachment_url, attachment_type = support_message_fields(data)
    if not message_text and not attachment_url:
        return {"error": "Empty message"}, 400

    if attachment_type == "location" and not message_text and attachment_url:
        try:
            from app.blueprints.farmer.support_chat import resolve_real_location

            lat, lon = map(float, attachment_url.split(","))
            loc = resolve_real_location(lat=lat, lon=lon)
            message_text = f"📍 Location: {loc.get('display_name') or f'{lat:.4f}, {lon:.4f}'}"
        except Exception:
            message_text = "📍 Shared location"

    msg = AdminChatMessage(
        sender_id=current_user.id,
        receiver_id=partner_id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
    )
    db.session.add(msg)
    clear_typing(current_user.id, partner_id)

    try:
        target_user = db.session.get(User, partner_id)
        is_target_staff = (
            any(r.name == staff_role for r in target_user.roles) if target_user else False
        )
        inbox_url = "/expert/support_chats" if staff_role == "expert" else "/admin/support_chats"
        if is_target_staff:
            notify_user(
                user_id=partner_id,
                kind="support_chat",
                title=f"Message from {current_user.full_name or current_user.username}",
                subtitle=_snippet(message_text or f"Sent an {attachment_type or 'attachment'}", 60),
                url=inbox_url,
                icon="fas fa-comments",
                level="info",
                source_id=current_user.id,
            )
        else:
            title = "Agronomy Expert" if staff_role == "expert" else "Support Team"
            farmer_url = (
                "/farmer/live-chat?target=expert"
                if staff_role == "expert"
                else "/farmer/live-chat?target=admin"
            )
            notify_user(
                user_id=partner_id,
                kind="support_chat",
                title=title,
                subtitle=_snippet(message_text or f"Sent an {attachment_type or 'attachment'}", 60),
                url=farmer_url,
                icon="fas fa-headset",
                level="info",
                source_id=current_user.id,
            )
    except Exception:
        pass

    db.session.commit()
    return {"success": True, "message": serialize_chat_message(msg)}, 200


def handle_support_attachment_upload() -> tuple[dict[str, Any], int]:
    """Validate and store a live-support image or audio attachment."""
    if "file" not in request.files:
        return {"error": "No file part"}, 400
    try:
        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "chats")
        filename, mime_type = save_support_attachment(request.files["file"], upload_dir)
    except SupportAttachmentError as error:
        return {"error": str(error)}, error.status_code
    except Exception:
        current_app.logger.exception("Support attachment upload failed")
        return {"error": "Could not save attachment"}, 500
    return {
        "url": url_for("static", filename=f"uploads/chats/{filename}"),
        "mime_type": mime_type,
    }, 200


def resolve_client_location_payload() -> dict[str, Any]:
    """Resolve current request GPS or IP location for live chat sharing."""
    from app.blueprints.farmer.support_chat import resolve_real_location

    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    return resolve_real_location(lat=lat, lon=lon, ip_address=client_ip)


__all__ = [
    "normalize_support_target",
    "resolve_role_users",
    "resolve_farmer_support_partner",
    "farmer_channel_messages_query",
    "farmer_support_channels_summary",
    "staff_conversations_payload",
    "decorate_staff_inbox_users",
    "staff_thread_messages_payload",
    "staff_send_support_message",
    "handle_support_attachment_upload",
    "resolve_client_location_payload",
]
