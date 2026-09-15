"""Centralized security auditing and application audit-trail service.

Provides dual-channel event logging (structured application logs and database
AuditLog records) with automatic context enrichment (correlation request_id,
client IP, user agent), credential redaction, and fail-safe persistence.
"""
import logging
import re
from datetime import datetime
from typing import Optional

from flask import current_app, g, has_request_context, request
from flask_login import current_user

from app.extensions import db
from app.models.audit_log import AuditLog

# Dedicated logger for security and compliance audit events
security_logger = logging.getLogger("security.audit")

# Sensitive parameter keys that must never appear in log details
SENSITIVE_PATTERNS = [
    re.compile(r'(password|passwd|pwd)\s*[=:]\s*([^\s,;]+)', re.IGNORECASE),
    re.compile(r'(secret|token|id_token|auth_token)\s*[=:]\s*([^\s,;]+)', re.IGNORECASE),
    re.compile(r'(code|otp|verification_code)\s*[=:]\s*([^\s,;]+)', re.IGNORECASE),
    re.compile(r'(authorization|bearer)\s*[=:]\s*([^\s,;]+)', re.IGNORECASE),
    re.compile(r'(cookie|session)\s*[=:]\s*([^\s,;]+)', re.IGNORECASE),
]


def redact_sensitive(text: Optional[str]) -> Optional[str]:
    """Scrub passwords, OTP codes, and authentication tokens from text."""
    if not text or not isinstance(text, str):
        return text
    sanitized = text
    for pattern in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(r'\1=[REDACTED]', sanitized)
    return sanitized


def get_client_ip() -> str:
    """Retrieve the real client IP respecting configured trusted proxy hops."""
    if not has_request_context():
        return "-"
    # ProxyFix handles X-Forwarded-For if TRUSTED_PROXY_COUNT > 0
    return request.remote_addr or "-"


def audit_log(
    action: str,
    *,
    target_user: Optional[str] = None,
    detail: Optional[str] = None,
    user_id: Optional[int] = None,
    status: str = "SUCCESS",
    severity: str = "INFO",
) -> Optional[AuditLog]:
    """Record an audit event to both the application log stream and database.

    Never raises exceptions: if database persistence fails, an error is logged
    to the system logger and the active transaction is rolled back safely.
    """
    # 1. Resolve actor identity
    resolved_user_id = user_id
    actor_name = "anonymous"
    if resolved_user_id is None and has_request_context():
        try:
            if hasattr(current_app, "login_manager") and current_user and current_user.is_authenticated:
                resolved_user_id = getattr(current_user, "id", None)
                actor_name = getattr(current_user, "username", "authenticated")
        except Exception:
            pass
    elif resolved_user_id is not None:
        actor_name = f"user#{resolved_user_id}"

    # 2. Extract context
    request_id = getattr(g, "request_id", "-") if has_request_context() else "-"
    client_ip = get_client_ip()
    path = getattr(request, "path", "-") if has_request_context() else "-"
    method = getattr(request, "method", "-") if has_request_context() else "-"

    # 3. Sanitize detail
    sanitized_detail = redact_sensitive(detail)
    combined_detail_parts = []
    if client_ip != "-":
        combined_detail_parts.append(f"ip={client_ip}")
    if request_id != "-":
        combined_detail_parts.append(f"rid={request_id}")
    if status != "SUCCESS":
        combined_detail_parts.append(f"status={status}")
    if sanitized_detail:
        combined_detail_parts.append(sanitized_detail)
    final_detail = " ".join(combined_detail_parts) if combined_detail_parts else None

    # 4. Stream to structured logger
    log_msg = (
        f"[{request_id}] status={status} action={action} "
        f"actor={actor_name} target={target_user or '-'} "
        f"ip={client_ip} {method} {path} detail={sanitized_detail or '-'}"
    )
    level = getattr(logging, severity.upper(), logging.INFO)
    security_logger.log(level, log_msg)

    # 5. Persist to database (fail-safe)
    if hasattr(current_app, "extensions") and "sqlalchemy" in current_app.extensions:
        try:
            entry = AuditLog(
                user_id=resolved_user_id,
                action=action,
                target_user=target_user[:100] if target_user else None,
                detail=final_detail,
                created_at=datetime.utcnow(),
            )
            db.session.add(entry)
            db.session.commit()
            return entry
        except Exception as exc:
            try:
                db.session.rollback()
            except Exception:
                pass
            current_app.logger.warning(
                f"Failed to persist AuditLog ({action}): {exc}",
                exc_info=False
            )
            return None
    return None


def log_action(*args, **kwargs):
    """Backward-compatible signature supporting legacy log_action() callers.

    Supports:
      - log_action(admin_user, action, target_user=None, detail=None)
      - log_action(action, target_user=None, detail=None)
    """
    if len(args) == 0:
        return audit_log(**kwargs)

    first = args[0]
    # Check if first arg is a User instance / has 'id' attribute
    if hasattr(first, "id") and len(args) > 1:
        user = first
        action = args[1]
        target_user = args[2] if len(args) > 2 else kwargs.get("target_user")
        detail = args[3] if len(args) > 3 else kwargs.get("detail")
        return audit_log(
            action=action,
            target_user=target_user,
            detail=detail,
            user_id=user.id,
        )
    else:
        # First arg is action string
        action = str(first)
        target_user = args[1] if len(args) > 1 else kwargs.get("target_user")
        detail = args[2] if len(args) > 2 else kwargs.get("detail")
        return audit_log(
            action=action,
            target_user=target_user,
            detail=detail,
        )
