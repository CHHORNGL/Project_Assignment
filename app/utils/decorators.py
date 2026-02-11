from functools import wraps
from flask import abort
from flask_login import current_user, login_required


# ===============================
# ROLE REQUIRED
# ===============================
def role_required(role_name: str):
    """
    Usage:
        @role_required("admin")
        @role_required("expert")
        @role_required("farmer")
    """
    def decorator(func):
        @wraps(func)
        @login_required
        def wrapper(*args, **kwargs):

            # Not logged in (extra safety)
            if not current_user.is_authenticated:
                abort(401)

            # User model missing has_role()
            if not hasattr(current_user, "has_role"):
                abort(500, description="User model missing has_role()")

            # Role check failed
            if not current_user.has_role(role_name):
                abort(403)

            return func(*args, **kwargs)

        return wrapper
    return decorator


# ===============================
# PERMISSION REQUIRED
# ===============================
def permission_required(permission_code: str):
    """
    Usage:
        @permission_required("manage_users")
        @permission_required("view_dashboard")
        @permission_required("view_reports")
    """
    def decorator(func):
        @wraps(func)
        @login_required
        def wrapper(*args, **kwargs):

            # Not logged in
            if not current_user.is_authenticated:
                abort(401)

            # Admin role bypass (admins can access any permission-protected route).
            try:
                if hasattr(current_user, "has_role") and current_user.has_role("admin"):
                    return func(*args, **kwargs)
            except Exception:
                pass

            # User model missing has_permission()
            if not hasattr(current_user, "has_permission"):
                abort(500, description="User model missing has_permission()")

            # Permission check failed
            if not current_user.has_permission(permission_code):
                abort(403)

            return func(*args, **kwargs)

        return wrapper
    return decorator


# ===============================
# SHORTCUT DECORATORS
# ===============================
def admin_required(func):
    """
    Shortcut for:
        @role_required("admin")
    """
    return role_required("admin")(func)


def expert_required(func):
    """
    Shortcut for:
        @role_required("expert")
    """
    return role_required("expert")(func)


def farmer_required(func):
    """
    Shortcut for:
        @role_required("farmer")
    """
    return role_required("farmer")(func)
