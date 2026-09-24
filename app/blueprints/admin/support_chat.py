from app.utils.input_validation import support_message_fields
import os
import uuid
from werkzeug.utils import secure_filename
from flask import request, jsonify, render_template, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models import User, AdminChatMessage
from app.utils.decorators import role_required
from .routes import admin_bp

from datetime import datetime
from app.models.notification import Notification

@admin_bp.route("/support_chats", methods=["GET"])
@login_required
@role_required("admin")
def support_chats():
    # Get all users who have exchanged messages with admin
    subquery = db.session.query(AdminChatMessage.sender_id.label('uid')).union(
        db.session.query(AdminChatMessage.receiver_id.label('uid'))
    ).subquery()
    
    chat_users = User.query.join(subquery, User.id == subquery.c.uid).all()
    admins = User.query.filter(User.roles.any(name='admin')).all()
    
    user_dict = {u.id: u for u in chat_users}
    for a in admins:
        user_dict[a.id] = a
        
    final_users = list(user_dict.values())
    
    # Calculate unread messages and latest message timestamp for sorting
    unread_counts = dict(
        db.session.query(
            AdminChatMessage.sender_id,
            db.func.count(AdminChatMessage.id)
        ).filter(
            AdminChatMessage.is_read.is_(False)
        ).group_by(AdminChatMessage.sender_id).all()
    )

    latest_times = dict(
        db.session.query(
            db.case(
                (AdminChatMessage.sender_id == current_user.id, AdminChatMessage.receiver_id),
                else_=AdminChatMessage.sender_id
            ).label('partner_id'),
            db.func.max(AdminChatMessage.created_at)
        ).group_by('partner_id').all()
    )

    for u in final_users:
        u.unread_support_count = unread_counts.get(u.id, 0)
        u.latest_support_time = latest_times.get(u.id)

    final_users.sort(
        key=lambda u: (
            (u.unread_support_count or 0) > 0,
            u.latest_support_time or datetime.min
        ),
        reverse=True
    )
    
    return render_template("admin/support_chats.html", chat_users=final_users)


@admin_bp.route("/support_chat/conversations", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_conversations():
    subquery = db.session.query(AdminChatMessage.sender_id.label('uid')).union(
        db.session.query(AdminChatMessage.receiver_id.label('uid'))
    ).subquery()
    
    chat_users = User.query.join(subquery, User.id == subquery.c.uid).all()
    admins = User.query.filter(User.roles.any(name='admin')).all()
    
    user_dict = {u.id: u for u in chat_users}
    for a in admins:
        user_dict[a.id] = a
        
    final_users = list(user_dict.values())
    
    unread_counts = dict(
        db.session.query(
            AdminChatMessage.sender_id,
            db.func.count(AdminChatMessage.id)
        ).filter(
            AdminChatMessage.is_read.is_(False)
        ).group_by(AdminChatMessage.sender_id).all()
    )
    
    last_msgs = (
        db.session.query(AdminChatMessage)
        .order_by(AdminChatMessage.id.desc())
        .limit(200)
        .all()
    )
    latest_msg_map = {}
    for msg in last_msgs:
        partner_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        if partner_id not in latest_msg_map:
            latest_msg_map[partner_id] = msg

    result = []
    total_unread = 0
    for u in final_users:
        if u.id == current_user.id:
            continue
        cnt = unread_counts.get(u.id, 0)
        total_unread += cnt
        last_m = latest_msg_map.get(u.id)
        last_text = ""
        last_time = ""
        if last_m:
            last_text = last_m.message or f"[{last_m.attachment_type or 'attachment'}]"
            last_time = last_m.created_at.strftime("%Y-%m-%d %H:%M:%S")
        
        result.append({
            "id": u.id,
            "name": u.full_name or u.username,
            "username": u.username,
            "unread_count": cnt,
            "last_message": last_text,
            "last_message_time": last_time,
        })
        
    result.sort(
        key=lambda x: (x["unread_count"] > 0, x["last_message_time"]),
        reverse=True
    )
    return jsonify({
        "conversations": result,
        "total_unread": total_unread
    })


@admin_bp.route("/support_chat/<int:farmer_id>/messages", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_messages(farmer_id):
    target_user = db.session.get(User, farmer_id) if hasattr(db.session, 'get') else User.query.get(farmer_id)
    is_target_admin = any(r.name == 'admin' for r in target_user.roles) if target_user else False

    if is_target_admin:
        messages = AdminChatMessage.query.filter(
            db.or_(
                db.and_(AdminChatMessage.sender_id == current_user.id, AdminChatMessage.receiver_id == farmer_id),
                db.and_(AdminChatMessage.sender_id == farmer_id, AdminChatMessage.receiver_id == current_user.id)
            )
        ).order_by(AdminChatMessage.created_at.asc()).all()
    else:
        # Farmer support: all messages for this farmer
        messages = AdminChatMessage.query.filter(
            db.or_(
                AdminChatMessage.sender_id == farmer_id,
                AdminChatMessage.receiver_id == farmer_id
            )
        ).order_by(AdminChatMessage.created_at.asc()).all()

    # Mark incoming unread messages from this farmer as read
    unread_ids = [m.id for m in messages if m.sender_id == farmer_id and not m.is_read]
    if unread_ids:
        AdminChatMessage.query.filter(AdminChatMessage.id.in_(unread_ids)).update(
            {AdminChatMessage.is_read: True}, synchronize_session=False
        )
        Notification.query.filter(
            Notification.user_id == current_user.id,
            Notification.kind == "support_chat",
            Notification.source_id.in_([farmer_id] + unread_ids),
            Notification.read_at.is_(None)
        ).update({Notification.read_at: datetime.utcnow()}, synchronize_session=False)
        db.session.commit()

    return jsonify([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "message": msg.message,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "is_read": msg.is_read,
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for msg in messages])

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
        attachment_type=attachment_type
    )
    db.session.add(msg)

    try:
        from app.services.notification_service import notify_user, _snippet
        target_user = db.session.get(User, farmer_id) if hasattr(db.session, 'get') else User.query.get(farmer_id)
        is_target_admin = any(r.name == 'admin' for r in target_user.roles) if target_user else False
        if is_target_admin:
            notify_user(
                user_id=farmer_id,
                kind="support_chat",
                title=f"Message from {current_user.full_name or current_user.username}",
                subtitle=_snippet(message_text or f"Sent an {attachment_type or 'attachment'}", 60),
                url="/admin/support_chats",
                icon="fas fa-comments",
                level="info",
                source_id=current_user.id
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
                source_id=current_user.id
            )
    except Exception:
        pass

    db.session.commit()
    return jsonify({"success": True})


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
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'bin'
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'chats')
        os.makedirs(upload_dir, exist_ok=True)
        file.save(os.path.join(upload_dir, unique_name))
        from flask import url_for
        return jsonify({'url': url_for('static', filename=f'uploads/chats/{unique_name}')})
