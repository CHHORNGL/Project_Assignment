import os
import uuid
from werkzeug.utils import secure_filename
from flask import request, jsonify, render_template, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models import User, AdminChatMessage
from app.utils.decorators import role_required
from .routes import admin_bp

@admin_bp.route("/support_chats", methods=["GET"])
@login_required
@role_required("admin")
def support_chats():
    # Get all users who have exchanged messages with admin
    subquery = db.session.query(AdminChatMessage.sender_id.label('uid')).union(
        db.session.query(AdminChatMessage.receiver_id.label('uid'))
    ).subquery()
    
    chat_users = User.query.join(subquery, User.id == subquery.c.uid).all()
    
    # Always include all admins in the list so admins can chat with each other
    admins = User.query.filter(User.roles.any(name='admin')).all()
    
    # Combine unique users
    user_dict = {u.id: u for u in chat_users}
    for a in admins:
        user_dict[a.id] = a
        
    final_users = list(user_dict.values())
    
    return render_template("admin/support_chats.html", chat_users=final_users)

@admin_bp.route("/support_chat/<int:farmer_id>/messages", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_messages(farmer_id):
    messages = AdminChatMessage.query.filter(
        db.or_(
            db.and_(AdminChatMessage.sender_id == current_user.id, AdminChatMessage.receiver_id == farmer_id),
            db.and_(AdminChatMessage.sender_id == farmer_id, AdminChatMessage.receiver_id == current_user.id)
        )
    ).order_by(AdminChatMessage.created_at.asc()).all()

    return jsonify([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "message": msg.message,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for msg in messages])

@admin_bp.route("/support_chat/<int:farmer_id>/send", methods=["POST"])
@login_required
@role_required("admin")
def admin_send_message(farmer_id):
    data = request.get_json()
    message_text = data.get("message", "")
    attachment_url = data.get("attachment_url")
    attachment_type = data.get("attachment_type")

    if not message_text and not attachment_url:
        return jsonify({"error": "Empty message"}), 400
    
    msg = AdminChatMessage(
        sender_id=current_user.id,
        receiver_id=farmer_id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify({"success": True})

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
        return jsonify({'url': f"/static/uploads/chats/{unique_name}"})
