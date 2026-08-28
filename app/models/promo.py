from datetime import datetime
from app.extensions import db

class PromoCode(db.Model):
    __tablename__ = 'promo_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    tokens_reward = db.Column(db.Integer, nullable=False, default=1000)
    
    is_used = db.Column(db.Boolean, default=False, nullable=False)
    used_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete="SET NULL"), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Optional relationship back to the user who used it
    used_by = db.relationship('User', foreign_keys=[used_by_id])
    
    def __repr__(self):
        return f"<PromoCode {self.code} - {self.tokens_reward} tokens>"
