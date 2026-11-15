from app.extensions import db


class MixedAgriFact(db.Model):
    __tablename__ = "mixed_agri_facts"

    id = db.Column(db.Integer, primary_key=True)

    source_id = db.Column(
        db.Integer,
        db.ForeignKey("mixed_agri_sources.id", ondelete="CASCADE"),
        nullable=False
    )

    topic = db.Column(db.Text, nullable=False)
    region = db.Column(db.Text)
    fact_text = db.Column(db.Text, nullable=False)
    metric_value = db.Column(db.Numeric)
    metric_unit = db.Column(db.Text)
    metric_year = db.Column(db.Integer)

    source = db.relationship("MixedAgriSource", back_populates="facts")

    def __repr__(self):
        return f"<MixedAgriFact {self.topic}>"
