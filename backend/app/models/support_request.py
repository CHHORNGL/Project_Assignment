# app/models/support_request.py

from datetime import datetime

from app.extensions import db


class SupportRequest(db.Model):
    __tablename__ = "support_requests"

    id = db.Column(db.Integer, primary_key=True)

    requester_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    requester_role = db.Column(db.String(20), nullable=False)

    message = db.Column(db.Text, nullable=False)

    page = db.Column(db.String(255))
    user_agent = db.Column(db.String(255))

    # open | resolved
    status = db.Column(db.String(20), nullable=False, default="open")

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    resolved_at = db.Column(db.DateTime)
    resolved_by_id = db.Column(db.Integer, db.ForeignKey("users.id"))

    __table_args__ = (
        db.Index(
            "ix_support_requests_requester_status_resolved",
            "requester_id",
            "status",
            "resolved_at",
        ),
        db.Index("ix_support_requests_status_created", "status", "created_at"),
        db.Index("ix_support_requests_resolved_by_id", "resolved_by_id"),
    )

    requester = db.relationship("User", foreign_keys=[requester_id])
    resolved_by = db.relationship("User", foreign_keys=[resolved_by_id])

    def __repr__(self):
        return f"<SupportRequest id={self.id} requester={self.requester_id} status={self.status}>"
