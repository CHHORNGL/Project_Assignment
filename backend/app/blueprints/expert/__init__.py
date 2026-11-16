from flask import Blueprint, request
from flask_login import current_user

expert_bp = Blueprint(
    "expert",
    __name__,
    url_prefix="/expert",
    template_folder="../../templates/expert"
)

@expert_bp.before_request
def log_expert_activity():
    if current_user.is_authenticated:
        from app.services.audit_service import log_action
        
        # Don't log static file access or high-frequency live-chat polling
        if (
            request.endpoint
            and not request.endpoint.endswith('.static')
            and "/support_chat/" not in request.path
        ):
            action = f"EXPERT_{request.method}"
            detail = f"Accessed {request.path}"
            
            # If there's query params or it's a POST, we can add some context (safely without passwords)
            if request.method in ["POST", "PUT", "DELETE"]:
                detail += f" (Action taken on {request.endpoint})"
            
            log_action(action=action, target_user="System", detail=detail)

from . import routes
from . import knowledge
from . import support_chat
