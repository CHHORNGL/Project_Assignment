from app.extensions import db
from app.models.associations import rule_symptoms
from app.utils.i18n import get_current_language, normalize_display_text


class Rule(db.Model):
    __tablename__ = "rules"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(150), nullable=False)

    disease_id = db.Column(
        db.Integer,
        db.ForeignKey("diseases.id", ondelete="CASCADE"),
        nullable=False
    )

    # Expert confidence (0–1)
    confidence = db.Column(db.Float, default=0.0)

    # ===============================
    # Relationships
    # ===============================

    # Each rule belongs to one disease
    disease = db.relationship("Disease", back_populates="rules")

    # Each rule has many symptoms
    symptoms = db.relationship(
        "Symptom",
        secondary=rule_symptoms,
        backref="rules",
        lazy="joined"
    )

    # ===============================
    # Helper methods
    # ===============================

    def symptom_names(self):
        lang = get_current_language()
        if lang == "km":
            return [normalize_display_text(s.name_kh or s.name, lang=lang) for s in self.symptoms]
        return [normalize_display_text(s.name, lang=lang) for s in self.symptoms]

    def __repr__(self):
        return f"<Rule {self.name}>"
