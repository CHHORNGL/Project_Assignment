from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    tables = [
        "chat_messages",
        "chat_sessions",
        "admin_chats",
        "diagnoses",
        "diagnosis_results",
        "expert_diagnoses",
        "notifications",
        "support_requests"
    ]
    
    for t in tables:
        try:
            res = db.session.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"{t}: {res}")
        except Exception as e:
            print(f"{t}: Error")
            db.session.rollback()
