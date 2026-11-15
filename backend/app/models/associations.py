from app.extensions import db

# =====================================================
# USER ↔ ROLE (Many-to-Many)
# =====================================================
user_roles = db.Table(
    "user_roles",
    db.metadata,   # 🔥 IMPORTANT: use shared metadata
    db.Column(
        "user_id",
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "role_id",
        db.Integer,
        db.ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

# =====================================================
# ROLE ↔ PERMISSION (Many-to-Many)
# =====================================================
role_permissions = db.Table(
    "role_permissions",
    db.metadata,   # 🔥 IMPORTANT: use shared metadata
    db.Column(
        "role_id",
        db.Integer,
        db.ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "permission_id",
        db.Integer,
        db.ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

# =====================================================
# 🧠 RULE ↔ SYMPTOM (Expert System Knowledge Base)
# =====================================================
rule_symptoms = db.Table(
    "rule_symptoms",
    db.metadata,   # 🔥 IMPORTANT: use shared metadata
    db.Column(
        "rule_id",
        db.Integer,
        db.ForeignKey("rules.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    db.Column(
        "symptom_id",
        db.Integer,
        db.ForeignKey("symptoms.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
