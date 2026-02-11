# app/blueprints/assistant/routes.py

from datetime import datetime

from flask import jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.support_request import SupportRequest
from app.services.project_assistant import generate_project_reply
from app.services.notification_service import notify_role, _snippet
from app.utils.i18n import t

from . import assistant_bp


_AI_RATE_LIMIT = {
    "window_seconds": 60,
    "max_requests": 30,
    "buckets": {},
}


def _rate_limited(key: str) -> bool:
    now = datetime.utcnow().timestamp()
    bucket = _AI_RATE_LIMIT["buckets"].get(key)
    if not bucket or now - bucket["start"] > _AI_RATE_LIMIT["window_seconds"]:
        _AI_RATE_LIMIT["buckets"][key] = {"start": now, "count": 1}
        return False
    bucket["count"] += 1
    return bucket["count"] > _AI_RATE_LIMIT["max_requests"]


def _allowed_role() -> bool:
    try:
        return (
            current_user.is_authenticated
            and hasattr(current_user, "has_role")
            and (current_user.has_role("farmer") or current_user.has_role("expert"))
        )
    except Exception:
        return False


def _role_label() -> str:
    try:
        if current_user.has_role("admin"):
            return "admin"
        if current_user.has_role("expert"):
            return "expert"
        if current_user.has_role("farmer"):
            return "farmer"
    except Exception:
        pass
    return "user"


@assistant_bp.route("/ask", methods=["POST"])
@login_required
def ask():
    if not _allowed_role():
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    key = f"user:{current_user.id}"
    if _rate_limited(key):
        return jsonify({"ok": False, "error": "Rate limit exceeded"}), 429

    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    page = (payload.get("page") or "").strip()

    if not message:
        return jsonify({"ok": False, "error": "Empty message"}), 400
    if len(message) > 1200:
        return jsonify({"ok": False, "error": "Message too long"}), 400

    reply = generate_project_reply(message, user_role=_role_label(), page=page)
    if not reply:
        return jsonify({"ok": False, "error": t("ai_unavailable")}), 503

    return jsonify({"ok": True, "reply": reply})


@assistant_bp.route("/support", methods=["POST"])
@login_required
def support():
    if not _allowed_role():
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    key = f"support:{current_user.id}"
    if _rate_limited(key):
        return jsonify({"ok": False, "error": "Rate limit exceeded"}), 429

    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    page = (payload.get("page") or "").strip()

    if not message:
        return jsonify({"ok": False, "error": "Empty message"}), 400
    if len(message) > 2000:
        return jsonify({"ok": False, "error": "Message too long"}), 400

    req = SupportRequest(
        requester_id=current_user.id,
        requester_role=_role_label(),
        message=message,
        page=page or None,
        user_agent=(request.headers.get("User-Agent") or "")[:255] or None,
        status="open",
    )
    try:
        db.session.add(req)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"ok": False, "error": t("support_inbox_unavailable")}), 503

    # Notify admins (best-effort; never fail the support submission).
    try:
        notify_role(
            role_name="admin",
            kind="support_request_open",
            title="Support request",
            subtitle=_snippet(message),
            url="/admin/support-requests",
            icon="fas fa-life-ring",
            level="danger",
            source_id=req.id,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({"ok": True, "id": req.id})
