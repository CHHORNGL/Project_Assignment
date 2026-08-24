# seed_farmer.py
import os
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role

app = create_app()

with app.app_context():
    FARMER_PASSWORD = os.environ.get("FARMER_PASSWORD")

    if not FARMER_PASSWORD:
        raise RuntimeError("FARMER_PASSWORD is not configured")

    # Check if farmer already exists
    farmer = User.query.filter_by(username="farmer").first()
    if farmer:
        print("ℹ️ Farmer user already exists")
        exit()

    # Create farmer user
    farmer = User(username="farmer")
    farmer.set_password(FARMER_PASSWORD)

    # Assign farmer role
    farmer_role = Role.query.filter_by(name="farmer").first()
    if not farmer_role:
        print("❌ Farmer role not found. Run seed_roles.py first.")
        exit()

    farmer.roles.append(farmer_role)

    db.session.add(farmer)
    db.session.commit()

    print("✅ Farmer user created successfully")
