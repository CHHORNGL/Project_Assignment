from app import create_app
from app.extensions import db
from app.models.user import User
from sqlalchemy import text, or_

app = create_app()

with app.app_context():
    tables = [
        "chat_messages",
        "chat_sessions",
        "admin_chat_messages",
        "admin_chats",
        "diagnosis",
        "expert_diagnoses",
        "diagnosis_results",
        "notifications",
        "support_requests",
        "user_passkeys",
        "theme_profiles",
        "audit_logs",
        "expert_question_answers",
        "expert_questions"
    ]
    
    for t in tables:
        try:
            db.session.execute(text(f"DELETE FROM {t}"))
            db.session.commit()
        except Exception as e:
            db.session.rollback()

    users_to_delete = User.query.filter(or_(User.email != 'iks214262@gmail.com', User.email.is_(None))).all()
    for u in users_to_delete:
        try:
            db.session.execute(text("DELETE FROM user_roles WHERE user_id = :uid"), {"uid": u.id})
            db.session.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": u.id})
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Failed to delete {u.username}: {e}")
            
    super_admin = User.query.filter_by(email='iks214262@gmail.com').first()
    if super_admin:
        super_admin.set_password('12345678')
        super_admin.is_active = True
        super_admin.is_verified = True
        db.session.commit()
        print("✅ Ensured Super Admin iks214262@gmail.com has password '12345678'")
    
    print("Database cleared!")
