from app.extensions import db
from .associations import user_roles, role_permissions


# ===============================
# ROLE MODEL
# ===============================
class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    route_type = db.Column(db.String(50), default='farmer', nullable=False)

    # ===============================
    # RELATIONSHIPS
    # ===============================
    users = db.relationship(
        "User",
        secondary=user_roles,
        back_populates="roles",
        lazy="dynamic"
    )

    permissions = db.relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
        lazy="joined"
    )

    # ===============================
    # HELPERS
    # ===============================
    def has_permission(self, permission_code: str) -> bool:
        if not self.permissions:
            return False
        return any(p.code == permission_code for p in self.permissions)

    # ===============================
    # DEBUG / DISPLAY
    # ===============================
    def __repr__(self):
        return f"<Role {self.name}>"
