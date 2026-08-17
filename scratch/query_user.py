import sys
import os

# Setup Flask context
sys.path.append('.')
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.role import Role

app = create_app()
with app.app_context():
    user = User.query.filter_by(email='iks214262@gmail.com').first()
    if not user:
        print("User not found.")
    else:
        print(f"User: {user.username} ({user.email})")
        print("Roles:", [r.name for r in user.roles])
