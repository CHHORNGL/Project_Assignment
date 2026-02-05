# app/models/symptom.py

from app.extensions import db

class Symptom(db.Model):
    __tablename__ = "symptoms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, unique=True)
    name_kh = db.Column(db.String(180))
    description = db.Column(db.Text)
    description_kh = db.Column(db.Text)

    def __repr__(self):
        return self.name
