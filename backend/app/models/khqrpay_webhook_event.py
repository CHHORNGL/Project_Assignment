from datetime import datetime

from app.extensions import db


class KHQRPayWebhookEvent(db.Model):
    """Deduplication log for incoming KHQRPay webhook events (deduplicated by event_id, not payment_id)."""

    __tablename__ = "khqrpay_webhook_events"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(128), unique=True, index=True, nullable=False)
    event_type = db.Column(db.String(64), index=True, nullable=False)
    payment_id = db.Column(db.String(128), index=True, nullable=True)
    reference_id = db.Column(db.String(255), index=True, nullable=True)
    livemode = db.Column(db.Boolean, default=False, nullable=False)
    is_test = db.Column(db.Boolean, default=False, nullable=False)
    delivery_id = db.Column(db.String(128), nullable=True)
    payload_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<KHQRPayWebhookEvent {self.event_id} ({self.event_type}) payment={self.payment_id}>"
