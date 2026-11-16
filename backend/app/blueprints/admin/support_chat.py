from datetime import datetime
import os

from flask import current_app, jsonify, request, url_for
from flask_login import current_user, login_required

from app.extensions import db
from app.models import AdminChatMessage, User
from app.models.notification import Notification
from app.utils.decorators import role_required
from app.utils.input_validation import support_message_fields
from app.utils.react_bootstrap import (
    build_admin_support_chats_bootstrap,
    render_react_page,
)
from app.utils.support_attachments import SupportAttachmentError, save_support_attachment
from app.utils.support_chat_realtime import (
    clear_typing,
    is_typing,
    serialize_chat_message,
    set_typing,
)
from .routes import admin_bp


def _primary_role_label(user: User) -> str:
    roles = [getattr(r, "name", "") for r in getattr(user, "roles", [])]
    for candidate in ("admin", "expert", "farmer"):
        if candidate in roles:
            return candidate
    return roles[0] if roles else "member"


def _load_support_partners() -> tuple[list[User], set[int]]:
    subquery = db.session.query(AdminChatMessage.sender_id.label("uid")).union(
        db.session.query(AdminChatMessage.receiver_id.label("uid"))
    ).subquery()

    chat_users = User.query.join(subquery, User.id == subquery.c.uid).all()
    admins = User.query.filter(User.roles.any(name="admin")).all()
    admin_ids = {a.id for a in admins}

    user_dict = {u.id: u for u in chat_users}
    for admin in admins:
        user_dict[admin.id] = admin

    return list(user_dict.values()), admin_ids


def _unread_counts_for_current_admin(admin_ids: set[int]) -> dict[int, int]:
    """Count unread incoming messages per conversation partner accurately."""
    unread_rows = (
        db.session.query(
            AdminChatMessage.sender_id,
            AdminChatMessage.receiver_id,
            db.func.count(AdminChatMessage.id),
        )
        .filter(AdminChatMessage.is_read.is_(False))
        .group_by(AdminChatMessage.sender_id, AdminChatMessage.receiver_id)
        .all()
    )
    counts: dict[int, int] = {}
    for sender_id, receiver_id, qty in unread_rows:
        if sender_id == current_user.id:
            continue
        if sender_id in admin_ids and receiver_id != current_user.id:
            continue
        counts[sender_id] = counts.get(sender_id, 0) + int(qty or 0)
    return counts


def _latest_message_map(admin_ids: set[int]) -> dict[int, AdminChatMessage]:
    recent = (
        db.session.query(AdminChatMessage)
        .order_by(AdminChatMessage.id.desc())
        .limit(300)
        .all()
    )
    latest_map: dict[int, AdminChatMessage] = {}
    for msg in recent:
        sender_is_admin = msg.sender_id in admin_ids
        receiver_is_admin = msg.receiver_id in admin_ids

        if sender_is_admin and receiver_is_admin:
            if msg.sender_id != current_user.id and msg.receiver_id != current_user.id:
                continue
            partner_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        elif not sender_is_admin:
            partner_id = msg.sender_id
        else:
            partner_id = msg.receiver_id

        if partner_id not in latest_map:
            latest_map[partner_id] = msg
    return latest_map


@admin_bp.route("/support_chats", methods=["GET"])
@login_required
@role_required("admin")
def support_chats():
    final_users, admin_ids = _load_support_partners()
    unread_counts = _unread_counts_for_current_admin(admin_ids)
    latest_map = _latest_message_map(admin_ids)

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
        u.support_role = _primary_role_label(u)

    final_users.sort(
        key=lambda u: (
            (u.unread_support_count or 0) > 0,
            u.latest_support_time or datetime.min,
        ),
        reverse=True,
    )

    return render_react_page(
        bootstrap_payload=build_admin_support_chats_bootstrap(chat_users=final_users),
        title="Live Support",
    )


@admin_bp.route("/support_chat/conversations", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_conversations():
    final_users, admin_ids = _load_support_partners()
    unread_counts = _unread_counts_for_current_admin(admin_ids)
    latest_map = _latest_message_map(admin_ids)

    result = []
    total_unread = 0
    for u in final_users:
        if u.id == current_user.id:
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
                "role": _primary_role_label(u),
                "avatar_url": url_for("user.avatar", user_id=u.id),
                "unread_count": cnt,
                "last_message": last_text,
                "last_message_time": last_time,
                "last_sender_id": last_sender_id,
                "is_typing": is_typing(u.id, current_user.id),
            }
        )

    result.sort(
        key=lambda x: (x["unread_count"] > 0, x["last_message_time"]),
        reverse=True,
    )
    return jsonify({"conversations": result, "total_unread": total_unread})


@admin_bp.route("/support_chat/<int:farmer_id>/messages", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_messages(farmer_id):
    target_user = (
        db.session.get(User, farmer_id)
        if hasattr(db.session, "get")
        else User.query.get(farmer_id)
    )
    is_target_admin = any(r.name == "admin" for r in target_user.roles) if target_user else False

    after_id = request.args.get("after_id", type=int)
    envelope = (request.args.get("envelope") or "").strip().lower() in {"1", "true", "yes"}

    if is_target_admin:
        base_query = AdminChatMessage.query.filter(
            db.or_(
                db.and_(
                    AdminChatMessage.sender_id == current_user.id,
                    AdminChatMessage.receiver_id == farmer_id,
                ),
                db.and_(
                    AdminChatMessage.sender_id == farmer_id,
                    AdminChatMessage.receiver_id == current_user.id,
                ),
            )
        )
    else:
        base_query = AdminChatMessage.query.filter(
            db.or_(
                AdminChatMessage.sender_id == farmer_id,
                AdminChatMessage.receiver_id == farmer_id,
            )
        )

    full_history_ids_unread = [
        row[0]
        for row in base_query.with_entities(AdminChatMessage.id)
        .filter(
            AdminChatMessage.sender_id == farmer_id,
            AdminChatMessage.is_read.is_(False),
            *(
                [AdminChatMessage.receiver_id == current_user.id]
                if is_target_admin
                else []
            ),
        )
        .all()
    ]
    if full_history_ids_unread:
        AdminChatMessage.query.filter(AdminChatMessage.id.in_(full_history_ids_unread)).update(
            {AdminChatMessage.is_read: True}, synchronize_session=False
        )
        Notification.query.filter(
            Notification.user_id == current_user.id,
            Notification.kind == "support_chat",
            Notification.source_id.in_([farmer_id] + full_history_ids_unread),
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
                AdminChatMessage.sender_id == current_user.id,
                AdminChatMessage.is_read.is_(True),
            )
            .all()
        ]
        return jsonify(
            {
                "messages": serialized,
                "read_ids": read_ids,
                "partner_typing": is_typing(farmer_id, current_user.id),
            }
        )

    return jsonify(serialized)


@admin_bp.route("/support_chat/<int:farmer_id>/typing", methods=["POST"])
@login_required
@role_required("admin")
def admin_typing_indicator(farmer_id):
    set_typing(current_user.id, farmer_id, ttl_seconds=5)
    return jsonify({"ok": True})


@admin_bp.route("/support_chat/<int:farmer_id>/send", methods=["POST"])
@login_required
@role_required("admin")
def admin_send_message(farmer_id):
    data = request.get_json()
    message_text, attachment_url, attachment_type = support_message_fields(data)

    if not message_text and not attachment_url:
        return jsonify({"error": "Empty message"}), 400

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
        receiver_id=farmer_id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type,
    )
    db.session.add(msg)
    clear_typing(current_user.id, farmer_id)

    try:
        from app.services.notification_service import _snippet, notify_user

        target_user = (
            db.session.get(User, farmer_id)
            if hasattr(db.session, "get")
            else User.query.get(farmer_id)
        )
        is_target_admin = any(r.name == "admin" for r in target_user.roles) if target_user else False
        if is_target_admin:
            notify_user(
                user_id=farmer_id,
                kind="support_chat",
                title=f"Message from {current_user.full_name or current_user.username}",
                subtitle=_snippet(message_text or f"Sent an {attachment_type or 'attachment'}", 60),
                url="/admin/support_chats",
                icon="fas fa-comments",
                level="info",
                source_id=current_user.id,
            )
        else:
            notify_user(
                user_id=farmer_id,
                kind="support_chat",
                title="Support Team",
                subtitle=_snippet(message_text or f"Sent an {attachment_type or 'attachment'}", 60),
                url="/farmer/dashboard",
                icon="fas fa-headset",
                level="info",
                source_id=current_user.id,
            )
    except Exception:
        pass

    db.session.commit()
    return jsonify({"success": True, "message": serialize_chat_message(msg)})


@admin_bp.route("/support_chat/location", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_location():
    from app.blueprints.farmer.support_chat import resolve_real_location

    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()
    return jsonify(resolve_real_location(lat=lat, lon=lon, ip_address=client_ip))


@admin_bp.route("/support_chat/location/search", methods=["GET"])
@login_required
@role_required("admin")
def admin_search_location():
    from app.blueprints.farmer.support_chat import search_support_location

    return search_support_location()


@admin_bp.route("/support_chat/upload", methods=["POST"])
@login_required
@role_required("admin")
def upload_support_attachment():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400
    try:
        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "chats")
        filename, mime_type = save_support_attachment(request.files["file"], upload_dir)
    except SupportAttachmentError as error:
        return jsonify({"error": str(error)}), error.status_code
    except Exception:
        current_app.logger.exception("Support attachment upload failed")
        return jsonify({"error": "Could not save attachment"}), 500
    return jsonify(
        {"url": url_for("static", filename=f"uploads/chats/{filename}"), "mime_type": mime_type}
    )
