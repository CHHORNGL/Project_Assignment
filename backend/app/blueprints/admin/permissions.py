from flask_login import current_user
from flask import abort
from functools import wraps


def permission_required(code):
    """
    Permission-based access control decorator

    - Admin role ALWAYS allowed
    - Other users must have explicit permission
    """

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):

            # Not logged in
            if not current_user.is_authenticated:
                abort(401)

            # ✅ ADMIN BYPASS (CRITICAL FIX)
            if current_user.has_role("admin"):
                return f(*args, **kwargs)

            # Check permission for non-admin users
            if not current_user.has_permission(code):
                abort(403)

            return f(*args, **kwargs)

        return wrapper

    return decorator
