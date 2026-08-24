# seed_expert.py
import os
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    EXPERT_EMAIL = os.environ.get("EXPERT_EMAIL")
    EXPERT_PASSWORD = os.environ.get("EXPERT_PASSWORD")

    if not EXPERT_EMAIL:
        raise RuntimeError("EXPERT_EMAIL is not configured")

    if not EXPERT_PASSWORD:
        raise RuntimeError("EXPERT_PASSWORD is not configured")

    expert = User.query.filter(
        (User.username == "expert1") | (User.email == EXPERT_EMAIL)
    ).first()

    expert_role = Role.query.filter_by(name="expert").first()
    if not expert_role:
        print("❌ Expert role not found")
        exit()

    if not expert:
        expert = User(
            username="expert1",
            email=EXPERT_EMAIL,
            password_hash=generate_password_hash(EXPERT_PASSWORD),
            is_verified=True
        )
        expert.roles.append(expert_role)
        db.session.add(expert)
        db.session.commit()
        print(f"✅ Expert user created ({EXPERT_EMAIL})")
    else:
        expert.email = EXPERT_EMAIL
        expert.is_verified = True
        expert.is_active = True
        if expert_role not in expert.roles:
            expert.roles.append(expert_role)
        db.session.commit()
        print(f"✅ Expert user updated ({EXPERT_EMAIL})")
