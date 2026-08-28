from flask import Blueprint

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth",
    template_folder="../../templates"
)

from flask_login import user_logged_in, user_logged_out
from app.models.audit_log import AuditLog
from app.extensions import db

def log_auth_event(sender, user, **extra):
    if user and user.is_authenticated and (user.has_role("admin") or user.has_role("expert")):
        action = "USER_LOGIN"
        detail = f"{user.username} logged into the system."
        
        log = AuditLog(
            user_id=user.id,
            action=action,
            target_user=user.username,
            detail=detail
        )
        db.session.add(log)
        db.session.commit()

def log_auth_event_out(sender, user, **extra):
    if user and user.is_authenticated and (user.has_role("admin") or user.has_role("expert")):
        action = "USER_LOGOUT"
        detail = f"{user.username} logged out of the system."
        
        log = AuditLog(
            user_id=user.id,
            action=action,
            target_user=user.username,
            detail=detail
        )
        db.session.add(log)
        db.session.commit()

user_logged_in.connect(log_auth_event)
user_logged_out.connect(log_auth_event_out)

from . import routes
