from datetime import datetime

from app.extensions import db


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Application-defined category for deduplication and filtering
    kind = db.Column(db.String(50), nullable=False, index=True)

    title = db.Column(db.String(255), nullable=False)
    subtitle = db.Column(db.Text)

    url = db.Column(db.String(500))
    icon = db.Column(db.String(64), default="fas fa-bell")
    level = db.Column(db.String(20), default="info")  # info|success|warning|danger

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_at = db.Column(db.DateTime, index=True)

    # Optional source reference for deduplication
    source_id = db.Column(db.Integer, index=True)

    __table_args__ = (
        # Avoid creating the same notification twice for the same user.
        db.UniqueConstraint("user_id", "kind", "source_id", name="uq_notifications_user_kind_source"),
        db.Index("ix_notifications_user_unread_created", "user_id", "read_at", "created_at"),
    )

    user = db.relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<Notification id={self.id} user={self.user_id} kind={self.kind}>"

