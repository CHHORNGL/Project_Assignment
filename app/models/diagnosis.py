from datetime import datetime
from app.extensions import db


class Diagnosis(db.Model):
    __tablename__ = "expert_diagnoses"

    # ===============================
    # PRIMARY KEY
    # ===============================
    id = db.Column(db.Integer, primary_key=True)

    # ===============================
    # FARMER (OWNER)
    # ===============================
    farmer_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    # ===============================
    # CROP INFO
    # ===============================
    crop_id = db.Column(
        db.Integer,
        db.ForeignKey("crops.id"),
        nullable=True
    )

    crop_name = db.Column(
        db.String(100),
        nullable=False
    )

    diagnosis_category = db.Column(
        db.String(40),
        nullable=True
    )

    # ===============================
    # DISEASE INFO
    # ===============================
    disease_id = db.Column(
        db.Integer,
        db.ForeignKey("diseases.id"),
        nullable=True   # AUTO diagnosis may be None
    )

    disease_name = db.Column(
        db.String(150),
        nullable=False,
        default="Unknown"
    )

    confidence = db.Column(
        db.Float,
        nullable=True
    )

    confidence_level = db.Column(
        db.String(20),
        nullable=True
    )

    # ===============================
    # SYMPTOMS & SOLUTION
    # ===============================
    symptoms = db.Column(
        db.Text,
        nullable=False
    )

    selected_symptom_ids = db.Column(
        db.JSON,
        nullable=True
    )

    denied_symptom_ids = db.Column(
        db.JSON,
        nullable=True
    )

    clarification_answers = db.Column(
        db.JSON,
        nullable=True
    )

    diagnosis_reason = db.Column(
        db.Text,
        nullable=True
    )

    diagnosis_evidence = db.Column(
        db.JSON,
        nullable=True
    )

    solution = db.Column(
        db.Text,
        nullable=True
    )

    prevention_recommendations = db.Column(
        db.Text,
        nullable=True
    )


    # ===============================
    # STATUS
    # ===============================
    status = db.Column(
        db.String(20),
        nullable=False,
        default="PENDING"
        # PENDING | AUTO | APPROVED | REJECTED
    )

    # ===============================
    # EXPERT (OPTIONAL)
    # ===============================
    expert_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # ===============================
    # TIMESTAMP
    # ===============================
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    feedback_rating = db.Column(
        db.String(20),
        nullable=True
    )

    feedback_comment = db.Column(
        db.Text,
        nullable=True
    )

    feedback_submitted_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # ===============================
    # RELATIONSHIPS
    # ===============================
    farmer = db.relationship(
        "User",
        foreign_keys=[farmer_id],
        backref=db.backref("farmer_diagnoses", lazy="dynamic")
    )

    expert = db.relationship(
        "User",
        foreign_keys=[expert_id],
        backref=db.backref("expert_diagnoses", lazy="dynamic")
    )

    crop = db.relationship("Crop")
    disease = db.relationship("Disease")

    # ===============================
    # BUSINESS METHODS
    # ===============================
    def approve(self, expert_id: int, solution: str):
        """Approve diagnosis by expert"""
        self.expert_id = expert_id
        self.solution = solution
        self.status = "APPROVED"

    def reject(self, expert_id: int):
        """Reject diagnosis by expert"""
        self.expert_id = expert_id
        self.status = "REJECTED"

    def submit_feedback(self, rating: str, comment: str | None = None):
        self.feedback_rating = rating
        self.feedback_comment = comment
        self.feedback_submitted_at = datetime.utcnow()

    # ===============================
    # STATUS HELPERS
    # ===============================
    @property
    def is_pending(self) -> bool:
        return self.status == "PENDING"

    @property
    def is_auto(self) -> bool:
        return self.status == "AUTO"

    @property
    def is_approved(self) -> bool:
        return self.status == "APPROVED"

    @property
    def is_rejected(self) -> bool:
        return self.status == "REJECTED"

    # ===============================
    # DEBUG / LOGGING
    # ===============================
    def __repr__(self):
        return (
            f"<Diagnosis id={self.id} "
            f"farmer_id={self.farmer_id} "
            f"crop='{self.crop_name}' "
            f"disease='{self.disease_name}' "
            f"status={self.status}>"
        )
