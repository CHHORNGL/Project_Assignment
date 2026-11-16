"""Admin live support chat inbox and messaging endpoints."""
from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from app.services.support_chat_service import (
    decorate_staff_inbox_users,
    handle_support_attachment_upload,
    resolve_client_location_payload,
    staff_conversations_payload,
    staff_send_support_message,
    staff_thread_messages_payload,
)
from app.utils.decorators import role_required
from app.utils.react_bootstrap import (
    build_admin_support_chats_bootstrap,
    render_react_page,
)
from app.utils.support_chat_realtime import set_typing
from .routes import admin_bp


@admin_bp.route("/support_chats", methods=["GET"])
@login_required
@role_required("admin")
def support_chats():
    final_users = decorate_staff_inbox_users("admin", current_user.id)
    return render_react_page(
        bootstrap_payload=build_admin_support_chats_bootstrap(chat_users=final_users, scope="admin"),
        title="Live Support",
    )


@admin_bp.route("/support_chat/conversations", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_conversations():
    return jsonify(staff_conversations_payload("admin", current_user.id))


@admin_bp.route("/support_chat/<int:farmer_id>/messages", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_messages(farmer_id):
    after_id = request.args.get("after_id", type=int)
    envelope = (request.args.get("envelope") or "").strip().lower() in {"1", "true", "yes"}
    return jsonify(
        staff_thread_messages_payload(
            staff_role="admin",
            current_user_id=current_user.id,
            partner_id=farmer_id,
            after_id=after_id,
            envelope=envelope,
        )
    )


@admin_bp.route("/support_chat/<int:farmer_id>/typing", methods=["POST"])
@login_required
@role_required("admin")
def admin_typing_indicator(farmer_id):
    set_typing(current_user.id, farmer_id, ttl_seconds=5)
    return jsonify({"ok": True})


@admin_bp.route("/support_chat/<int:farmer_id>/send", methods=["POST"])
@login_required
@role_required("admin")
def admin_send_message(farmer_id):
    payload, status = staff_send_support_message(
        staff_role="admin",
        current_user=current_user,
        partner_id=farmer_id,
        data=request.get_json(silent=True) or {},
    )
    return jsonify(payload), status


@admin_bp.route("/support_chat/location", methods=["GET"])
@login_required
@role_required("admin")
def admin_get_location():
    return jsonify(resolve_client_location_payload())


@admin_bp.route("/support_chat/location/search", methods=["GET"])
@login_required
@role_required("admin")
def admin_search_location():
    from app.blueprints.farmer.support_chat import search_support_location

    return search_support_location()


@admin_bp.route("/support_chat/upload", methods=["POST"])
@login_required
@role_required("admin")
def upload_support_attachment():
    payload, status = handle_support_attachment_upload()
    return jsonify(payload), status
