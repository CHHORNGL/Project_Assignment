from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()
with app.app_context():
    users = User.query.all()
    for u in users:
        print(f"User: {u.username}, Email: {u.email}, Password_hash: {u.password_hash[:10]}")
