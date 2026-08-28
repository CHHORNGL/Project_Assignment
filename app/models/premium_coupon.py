from datetime import datetime
from app.extensions import db

class PremiumCoupon(db.Model):
    __tablename__ = 'premium_coupons'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    discount_type = db.Column(db.String(20), nullable=False, default='percent') # 'percent' or 'fixed'
    discount_value = db.Column(db.Float, nullable=False, default=10.0) # e.g. 20 for 20% or 5.0 for $5
    max_uses = db.Column(db.Integer, nullable=False, default=100)
    times_used = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def is_valid(self):
        if not self.is_active:
            return False, "Coupon is not active."
        if self.max_uses and self.times_used >= self.max_uses:
            return False, "Coupon usage limit has been reached."
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False, "Coupon has expired."
        return True, "Coupon is valid."

    def calculate_discount(self, original_price):
        try:
            orig = float(original_price)
        except (TypeError, ValueError):
            orig = 20.0
        
        if self.discount_type == 'percent':
            discount_amount = round(orig * (self.discount_value / 100.0), 2)
        else:
            discount_amount = round(min(orig, self.discount_value), 2)
        
        final_price = max(0.0, round(orig - discount_amount, 2))
        return discount_amount, final_price

    def __repr__(self):
        return f"<PremiumCoupon {self.code} ({self.discount_value}{'%' if self.discount_type == 'percent' else '$'})>"
