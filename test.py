from app import create_app, db
from app.models.user import User
app = create_app()
with app.app_context():
    for u in User.query.all():
        print(f"User: {u.username}, Email: {u.email}")
