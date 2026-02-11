# app/models/user.py

from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db, login_manager
from .associations import user_roles


# ===============================
# FLASK-LOGIN USER LOADER
# ===============================
@login_manager.user_loader
def load_user(user_id):
    """
    Flask-Login callback
    """
    try:
        return User.query.get(int(user_id))
    except (TypeError, ValueError):
        return None


# ===============================
# USER MODEL
# ===============================
class User(db.Model, UserMixin):
    __tablename__ = "users"

    # ===============================
    # PRIMARY KEY
    # ===============================
    id = db.Column(db.Integer, primary_key=True)

    # ===============================
    # AUTH FIELDS
    # ===============================
    username = db.Column(
        db.String(50),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    # ===============================
    # THEME PREFERENCE 🌗
    # light | dark | system
    # ===============================
    theme = db.Column(
        db.String(10),
        default="system",
        nullable=False
    )

    # ===============================
    # ACCOUNT STATUS
    # ===============================
    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    # ===============================
    # PROFILE (AVATAR)
    # ===============================
    avatar_path = db.Column(
        db.String(255),
        nullable=True
    )
    avatar_data = db.Column(
        db.LargeBinary,
        nullable=True
    )
    avatar_mimetype = db.Column(
        db.String(50),
        nullable=True
    )

    # ===============================
    # PROFILE (NAME)
    # ===============================
    full_name = db.Column(
        db.String(120),
        nullable=True
    )

    # ===============================
    # OAUTH (GOOGLE)
    # ===============================
    email = db.Column(
        db.String(255),
        unique=True,
        nullable=True
    )

    google_sub = db.Column(
        db.String(255),
        unique=True,
        nullable=True
    )

    # ===============================
    # TIMESTAMP
    # ===============================
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # ===============================
    # RELATIONSHIPS
    # ===============================
    roles = db.relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
        lazy="joined"
    )

    # ===============================
    # PASSWORD HELPERS
    # ===============================
    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    # ===============================
    # ROLE CHECK
    # ===============================
    def has_role(self, role_name: str) -> bool:
        return any(role.name == role_name for role in self.roles)

    # ===============================
    # PERMISSION CHECK
    # ===============================
    def has_permission(self, permission_code: str) -> bool:
        for role in self.roles:
            for perm in getattr(role, "permissions", []):
                if perm.code == permission_code:
                    return True
        return False

    # ===============================
    # THEME HELPERS 🌗
    # ===============================
    def set_theme(self, theme: str):
        """
        Safely set theme: light | dark | system
        """
        if theme in ("light", "dark", "system"):
            self.theme = theme

    def prefers_dark(self) -> bool:
        """
        Returns True if user explicitly wants dark mode
        """
        return self.theme == "dark"

    # ===============================
    # FLASK-LOGIN OVERRIDE
    # ===============================
    def get_id(self):
        return str(self.id)

    # ===============================
    # DEBUG
    # ===============================
    def __repr__(self):
        return (
            f"<User id={self.id} "
            f"username={self.username} "
            f"active={self.is_active} "
            f"theme={self.theme}>"
        )
