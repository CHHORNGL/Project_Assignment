from datetime import datetime

from app.extensions import db


class ExpertQuestion(db.Model):
    __tablename__ = "expert_questions"

    id = db.Column(db.Integer, primary_key=True)

    crop_id = db.Column(
        db.Integer,
        db.ForeignKey("crops.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    prompt = db.Column(db.String(255), nullable=False)
    rule_code = db.Column(db.String(50), nullable=True, unique=True, index=True)
    category = db.Column(db.String(30), nullable=False, default="symptoms", index=True)
    description = db.Column(db.Text, nullable=True)
    canvas_x = db.Column(db.Float, nullable=False, default=120.0)
    canvas_y = db.Column(db.Float, nullable=False, default=120.0)

    is_root = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    image_data = db.Column(db.LargeBinary, nullable=True)
    image_mimetype = db.Column(db.String(120), nullable=True)

    created_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    crop = db.relationship("Crop")

    answers = db.relationship(
        "ExpertQuestionAnswer",
        foreign_keys="ExpertQuestionAnswer.question_id",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="ExpertQuestionAnswer.sort_order, ExpertQuestionAnswer.id",
        lazy="selectin",
    )

    def __repr__(self):
        return f"<ExpertQuestion id={self.id} crop_id={self.crop_id} category={self.category}>"
