from app.extensions import db

class Disease(db.Model):
    __tablename__ = "diseases"

    id = db.Column(db.Integer, primary_key=True)

    crop_id = db.Column(
        db.Integer,
        db.ForeignKey("crops.id"),
        nullable=False
    )

    name = db.Column(db.String(100), nullable=False)
    name_kh = db.Column(db.String(120))
    description = db.Column(db.Text)
    description_kh = db.Column(db.Text)
    treatment = db.Column(db.Text)
    treatment_kh = db.Column(db.Text)
    severity_level = db.Column(db.String(50))

    crop = db.relationship(
        "Crop",
        back_populates="diseases"
    )

    rules = db.relationship(
        "Rule",
        back_populates="disease",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<Disease {self.name}>"
