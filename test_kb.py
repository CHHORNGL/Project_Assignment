from app import create_app
from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
app = create_app()
with app.app_context():
    print(f"Crops: {Crop.query.count()}")
    print(f"Diseases: {Disease.query.count()}")
    print(f"Rules: {Rule.query.count()}")
