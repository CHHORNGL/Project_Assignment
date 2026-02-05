from flask_login import current_user
from app.extensions import db
from app.models.audit_log import AuditLog


def log_action(action, target_user=None, detail=None):
    if not current_user.is_authenticated:
        return

    log = AuditLog(
        user_id=current_user.id,
        action=action,
        target_user=target_user,
        detail=detail
    )
    db.session.add(log)
    db.session.commit()
