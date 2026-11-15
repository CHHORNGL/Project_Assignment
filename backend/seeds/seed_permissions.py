import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models.permission import Permission
from app.models.role import Role

app = create_app()

with app.app_context():
    permissions = {
        "farmer": [
            "submit_diagnosis",
            "view_own_diagnosis",
            "chat_expert"
        ],
        "expert": [
            "review_diagnosis",
            "reply_chat",
            "view_reports"
        ]
    }

    for role_name, perms in permissions.items():
        role = Role.query.filter_by(name=role_name).first()
        for code in perms:
            perm = Permission.query.filter_by(code=code).first()
            if not perm:
                perm = Permission(code=code, name=code.replace("_", " ").title())
                db.session.add(perm)
                db.session.commit()
            if perm not in role.permissions:
                role.permissions.append(perm)
        db.session.commit()
        print(f"✅ Permissions assigned to {role_name}")
