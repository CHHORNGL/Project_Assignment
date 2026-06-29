# seed_expert.py
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    expert = User.query.filter(
        (User.username == "expert1") | (User.email == "expert@gmail.com")
    ).first()

    expert_role = Role.query.filter_by(name="expert").first()
    if not expert_role:
        print("❌ Expert role not found")
        exit()

    if not expert:
        expert = User(
            username="expert1",
            email="expert@gmail.com",
            password_hash=generate_password_hash("expert123"),
            is_verified=True
        )
        expert.roles.append(expert_role)
        db.session.add(expert)
        db.session.commit()
        print("✅ Expert user created (expert@gmail.com / expert123)")
    else:
        expert.email = "expert@gmail.com"
        expert.is_verified = True
        expert.is_active = True
        expert.password_hash = generate_password_hash("expert123")
        if expert_role not in expert.roles:
            expert.roles.append(expert_role)
        db.session.commit()
        print("✅ Expert user updated (expert@gmail.com / expert123)")
