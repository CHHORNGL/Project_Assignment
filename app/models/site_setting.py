# app/models/site_setting.py

from app.extensions import db


class SiteSetting(db.Model):
    __tablename__ = "site_settings"

    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.String(255), nullable=False)

    def __repr__(self):
        return f"<SiteSetting {self.key}={self.value}>"
