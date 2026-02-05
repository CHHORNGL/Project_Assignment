# app/models/translation_backup.py

from datetime import datetime
from app.extensions import db


class TranslationBackup(db.Model):
    __tablename__ = "translation_backups"

    id = db.Column(db.Integer, primary_key=True)
    scope = db.Column(db.String(32), nullable=False)  # crops | diseases | symptoms | all
    payload = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<TranslationBackup {self.scope} {self.created_at}>"
