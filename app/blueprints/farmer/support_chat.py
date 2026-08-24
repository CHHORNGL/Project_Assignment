import os
import uuid
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from flask_login import current_user, login_required
from app.extensions import db
from app.models import User, AdminChatMessage
from app.utils.decorators import role_required
from .routes import farmer_bp

@farmer_bp.route("/support_chat/messages", methods=["GET"])
@login_required
@role_required("farmer")
def get_support_messages():
    cutoff = datetime.utcnow() - timedelta(hours=24)
    messages = AdminChatMessage.query.filter(
        db.or_(
            AdminChatMessage.sender_id == current_user.id,
            AdminChatMessage.receiver_id == current_user.id
        ),
        AdminChatMessage.created_at >= cutoff
    ).order_by(AdminChatMessage.created_at.asc()).all()

    return jsonify([{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "message": msg.message,
        "attachment_url": msg.attachment_url,
        "attachment_type": msg.attachment_type,
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for msg in messages])

@farmer_bp.route("/support_chat/send", methods=["POST"])
@login_required
@role_required("farmer")
def send_support_message():
    data = request.get_json()
    message_text = data.get("message", "")
    attachment_url = data.get("attachment_url")
    attachment_type = data.get("attachment_type")

    if not message_text and not attachment_url:
        return jsonify({"error": "Empty message"}), 400
    
    admin = User.query.filter(User.roles.any(name='admin')).first()
    if not admin:
        return jsonify({"error": "No admin available"}), 404
    
    msg = AdminChatMessage(
        sender_id=current_user.id,
        receiver_id=admin.id,
        message=message_text,
        attachment_url=attachment_url,
        attachment_type=attachment_type
    )
    db.session.add(msg)
    db.session.commit()
    
    return jsonify({"success": True})

@farmer_bp.route("/support_chat/upload", methods=["POST"])
@login_required
@role_required("farmer")
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
