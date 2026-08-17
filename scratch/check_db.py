import sys
sys.path.append(".")
from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    tables = [
        "chat_messages",
        "chat_sessions",
        "admin_chat_messages",
        "admin_chats",
        "expert_diagnoses",
        "diagnosis_results",
        "notifications",
        "support_requests",
        "user_passkeys",
        "theme_profiles",
        "audit_logs",
        "expert_question_answers",
        "expert_questions",
        "users"
    ]
    
    for t in tables:
        try:
            res = db.session.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"{t}: {res}")
        except Exception as e:
            print(f"{t}: Error {e}")
            db.session.rollback()
