from app.extensions import db


class MixedAgriSource(db.Model):
    __tablename__ = "mixed_agri_sources"

    id = db.Column(db.Integer, primary_key=True)
    source_title = db.Column(db.Text, nullable=False)
    source_org = db.Column(db.Text, nullable=False)
    publication_year = db.Column(db.Integer)
    source_type = db.Column(db.Text)
    source_url = db.Column(db.Text, unique=True)
    accessed_at = db.Column(db.Date, nullable=False)

    facts = db.relationship(
        "MixedAgriFact",
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    def __repr__(self):
        return f"<MixedAgriSource {self.source_title}>"
