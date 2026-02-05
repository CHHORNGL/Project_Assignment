from datetime import datetime
from app.extensions import db


class ChatSession(db.Model):
    __tablename__ = "chat_sessions"

    id = db.Column(db.Integer, primary_key=True)

    farmer_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    title = db.Column(db.String(200))

    session_type = db.Column(
        db.String(20),
        nullable=False,
        default="ai"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    farmer = db.relationship(
        "User",
        backref=db.backref("chat_sessions", lazy="dynamic")
    )

    messages = db.relationship(
        "ChatMessage",
        backref="session",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<ChatSession {self.id} farmer={self.farmer_id} type={self.session_type}>"
