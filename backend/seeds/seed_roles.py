import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.extensions import db
from app.models.role import Role

app = create_app()

with app.app_context():
    roles = ["farmer", "expert"]

    for name in roles:
        role = Role.query.filter_by(name=name).first()
        if not role:
            db.session.add(Role(name=name))
            db.session.commit()
            print(f"✅ Role {name} created")
        else:
            print(f"ℹ️ Role {name} already exists")
