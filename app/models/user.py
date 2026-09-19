# app/models/user.py

from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db, login_manager
from .associations import user_roles


# Explicit OWASP scrypt baseline: 128 MiB memory, random salt per password.
PASSWORD_HASH_METHOD = "scrypt:131072:8:1"
PASSWORD_SALT_LENGTH = 16


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
    # AI SETTINGS
    # ===============================
    ai_model = db.Column(
        db.String(50),
        default="gemini-1.5-flash",
        nullable=True
    )
    
    ai_api_key = db.Column(
        db.String(255),
        nullable=True
    )
    
    ai_credits = db.Column(
        db.Integer,
        default=13000,
        server_default="13000",
        nullable=False
    )

    last_credit_reset = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        server_default=db.func.now(),
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
    
    is_premium = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )
    premium_expires_at = db.Column(db.DateTime, nullable=True)

    # ===============================
    # TWO-STEP VERIFICATION & EMAIL VERIFY
    # ===============================
    is_verified = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )
    two_factor_enabled = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )
    two_factor_code = db.Column(
        db.String(6),
        nullable=True
    )
    two_factor_expiry = db.Column(
        db.DateTime,
        nullable=True
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
        if not isinstance(password, str) or not password:
            raise ValueError("Password must be a non-empty string")
        self.password_hash = generate_password_hash(
            password, method=PASSWORD_HASH_METHOD, salt_length=PASSWORD_SALT_LENGTH
        )

    def check_password(self, password: str, *, upgrade: bool = False) -> bool:
        """Verify without changing the password; optionally stage a hash upgrade.

        Login callers using upgrade=True must commit their transaction. Existing
        Werkzeug PBKDF2 and scrypt hashes remain usable without a password reset.
        """
        if not isinstance(password, str) or not password or not self.password_hash:
            return False
        method = self.password_hash.split("$", 1)[0]
        # Never accept Werkzeug's deprecated plaintext / fast-hash formats.
        if not method.startswith(("pbkdf2:", "scrypt:")):
            return False
        try:
            valid = check_password_hash(self.password_hash, password)
        except (ValueError, TypeError, OverflowError):
            return False
        if valid and upgrade and self._password_hash_needs_upgrade(method):
            self.set_password(password)
        return valid

    @staticmethod
    def _password_hash_needs_upgrade(method: str) -> bool:
        if not method.startswith("scrypt:"):
            return True
        _, n, r, p = method.split(":")
        # Preserve hashes whose parameters already meet or exceed our policy.
        return int(n) < 131072 or int(r) < 8 or int(p) < 1

    # ===============================
    # ROLE CHECK
    # ===============================
    def has_role(self, role_name: str) -> bool:
        return any(role.name == role_name for role in self.roles)

    def has_route_access(self, route_type: str) -> bool:
        return any(getattr(role, "route_type", "farmer") == route_type for role in self.roles)

    def get_route_role_name(self, route_type: str | None = None) -> str | None:
        """Return the assigned role name for a portal route.

        Custom roles inherit a route type (for example, ``field_officer`` can
        use the farmer portal). Display code must use that assigned role name
        instead of falling back to the built-in ``farmer`` label.
        """
        roles = list(self.roles or [])
        if route_type:
            for role in roles:
                if getattr(role, "route_type", None) == route_type:
                    return role.name
            return None
        return roles[0].name if roles else None

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
