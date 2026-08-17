# app/models/admin_chat.py
from datetime import datetime
from app.extensions import db

class AdminChatMessage(db.Model):
    __tablename__ = "admin_chat_messages"

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    attachment_url = db.Column(db.String(512), nullable=True)
    attachment_type = db.Column(db.String(50), nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])

    def __repr__(self):
        return f"<AdminChatMessage id={self.id} sender={self.sender_id} receiver={self.receiver_id}>"
