from app import create_app
from app.extensions import db
from app.models.role import Role

app = create_app()
with app.app_context():
    expert = Role.query.filter_by(name='expert').first()
    if expert:
        print("Expert permissions:", [p.code for p in expert.permissions])
    else:
        print("No expert role found")
