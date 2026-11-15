from datetime import datetime
from app.extensions import db


class PaymentTransaction(db.Model):
    __tablename__ = "payment_transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_method = db.Column(db.String(32), default="BAKONG_KHQR", nullable=False)
    bill_number = db.Column(db.String(64), index=True, nullable=False)
    md5 = db.Column(db.String(64), unique=True, index=True, nullable=True)
    qr_string = db.Column(db.Text, nullable=True)
    deeplink = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Float, nullable=False, default=0.0)
    currency = db.Column(db.String(10), default="USD", nullable=False)
    billing_interval = db.Column(db.String(20), default="monthly", nullable=False)
    status = db.Column(db.String(20), default="PENDING", index=True, nullable=False)  # PENDING, PAID, EXPIRED, CANCELLED
    coupon_code = db.Column(db.String(50), nullable=True)
    account_id = db.Column(db.String(128), nullable=True)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    paid_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", backref=db.backref("payment_transactions", lazy="dynamic", cascade="all, delete-orphan"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "payment_method": self.payment_method,
            "bill_number": self.bill_number,
            "md5": self.md5,
            "amount": self.amount,
            "currency": self.currency,
            "billing_interval": self.billing_interval,
            "status": self.status,
            "deeplink": self.deeplink,
            "coupon_code": self.coupon_code,
            "account_id": self.account_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
        }

    def __repr__(self):
        return f"<PaymentTransaction #{self.id} {self.bill_number} - {self.amount} {self.currency} ({self.status})>"
