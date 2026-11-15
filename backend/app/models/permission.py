from app.extensions import db
from .associations import role_permissions


# ===============================
# PERMISSION MODEL
# ===============================
class Permission(db.Model):
    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)

    # ===============================
    # RELATIONSHIPS
    # ===============================
    roles = db.relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions",
        lazy="dynamic"
    )

    # ===============================
    # HELPERS
    # ===============================
    def __repr__(self):
        return f"<Permission {self.code}>"
