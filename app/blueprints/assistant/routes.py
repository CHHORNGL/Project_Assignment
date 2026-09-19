from app.utils.input_validation import text_field
# app/blueprints/assistant/routes.py

from flask import jsonify, request
from flask_login import current_user, login_required

from app.extensions import db
from app.models.support_request import SupportRequest
from app.services.project_assistant import generate_project_reply
from app.services.notification_service import notify_role, _snippet
from app.utils.i18n import t

from . import assistant_bp


def _allowed_role() -> bool:
    try:
        if not current_user.is_authenticated:
            return False
        return True
    except Exception:
        return False


def _role_label() -> str:
    try:
        if hasattr(current_user, "has_role"):
            if current_user.has_role("admin"):
                return "admin"
            if current_user.has_role("expert"):
                return current_user.get_route_role_name("expert") or "expert"
            if current_user.has_route_access("farmer"):
                return current_user.get_route_role_name("farmer") or "farmer"
    except Exception:
        pass
    return "user"


@assistant_bp.route("/ask", methods=["POST"])
@login_required
def ask():
    if not _allowed_role():
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    message = text_field(payload, "message", required=True, maximum=2000)
    page = text_field(payload, "page", maximum=255)

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

    payload = request.get_json(silent=True) or {}
    message = text_field(payload, "message", required=True, maximum=2000)
    page = text_field(payload, "page", maximum=255)

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
