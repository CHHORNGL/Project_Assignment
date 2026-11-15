# app/models/audit_log.py

from datetime import datetime
from app.extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)

    # Who did the action (user/admin, or None for system/unauthenticated events)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=True
    )

    # Action type (e.g. AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE, USER_BAN, etc.)
    action = db.Column(
        db.String(100),
        nullable=False
    )

    # Target username / email / resource
    target_user = db.Column(
        db.String(100),
        nullable=True
    )

    # Extra detail (ip, request_id, reason, status, etc.)
    detail = db.Column(
        db.Text,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationship
    user = db.relationship("User")

    def __repr__(self):
        return (
            f"<AuditLog action={self.action} "
            f"user_id={self.user_id} "
            f"target={self.target_user}>"
        )
