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
    cause_explanation = db.Column(db.Text)
    treatment = db.Column(db.Text)
    treatment_kh = db.Column(db.Text)
    prevention_tips = db.Column(db.Text)
    agriculture_category = db.Column(db.String(80))
    agriculture_sub_category = db.Column(db.String(120))
    reference_scope = db.Column(db.String(50))
    visual_input_notes = db.Column(db.Text)
    reference_links = db.Column(db.Text)
    knowledge_image_data = db.Column(db.LargeBinary)
    knowledge_image_mimetype = db.Column(db.String(120))
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
