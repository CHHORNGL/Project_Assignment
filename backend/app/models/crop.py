from app.extensions import db

class Crop(db.Model):
    __tablename__ = "crops"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    name_kh = db.Column(db.String(120))
    emoji = db.Column(db.String(8))
    description = db.Column(db.Text)
    description_kh = db.Column(db.Text)

    diseases = db.relationship(
        "Disease",
        back_populates="crop",
        cascade="all, delete"
    )

    def __repr__(self):
        return f"<Crop {self.name}>"
