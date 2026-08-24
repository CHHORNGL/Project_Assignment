from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    tables = [
        "rule_conditions",
        "rules",
        "disease_symptoms",
        "symptoms",
        "diseases",
        "crops",
        "mixed_agri_facts",
        "mixed_agri_sources"
    ]
    
    for t in tables:
        try:
            db.session.execute(text(f"DELETE FROM {t}"))
            db.session.commit()
            print(f"Cleared {t}")
        except Exception as e:
            print(f"Error {t}: {e}")
            db.session.rollback()
    
    print("Knowledge base cleared.")
