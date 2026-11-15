from datetime import datetime

from app.extensions import db


class ExpertQuestionAnswer(db.Model):
    __tablename__ = "expert_question_answers"

    id = db.Column(db.Integer, primary_key=True)

    question_id = db.Column(
        db.Integer,
        db.ForeignKey("expert_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    label = db.Column(db.String(160), nullable=False)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    condition_type = db.Column(db.String(20), nullable=False, default="branch")

    next_question_id = db.Column(
        db.Integer,
        db.ForeignKey("expert_questions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    effect_type = db.Column(db.String(30), nullable=False, default="none")
    symptom_id = db.Column(
        db.Integer,
        db.ForeignKey("symptoms.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category_value = db.Column(db.String(40), nullable=True)

    is_terminal = db.Column(db.Boolean, nullable=False, default=False)
    final_diagnosis = db.Column(db.String(200), nullable=True)
    note = db.Column(db.String(200), nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    question = db.relationship(
        "ExpertQuestion",
        foreign_keys=[question_id],
        back_populates="answers",
    )
    next_question = db.relationship(
        "ExpertQuestion",
        foreign_keys=[next_question_id],
        uselist=False,
    )
    symptom = db.relationship("Symptom")

    def __repr__(self):
        return f"<ExpertQuestionAnswer id={self.id} question_id={self.question_id}>"
