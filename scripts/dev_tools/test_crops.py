from app import create_app
from app.models import Crop
app = create_app()
with app.app_context():
    for c in Crop.query.all(): print(c.name)
