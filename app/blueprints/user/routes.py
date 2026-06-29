# app/blueprints/user/routes.py

import os
from io import BytesIO
from datetime import datetime
from urllib.parse import quote_plus

from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    redirect,
    url_for,
    flash,
    abort,
    send_file
)
from flask_login import login_required, current_user

from app.extensions import db
from app.models.user import User
from app.models.notification import Notification
from app.models.passkey import UserPasskey
from app.services.notification_service import serialize_notification
from app.services.khmer_calendar import build_khmer_calendar_month
from app.services.theme_manager import resolve_active_runtime
from app.utils.i18n import set_current_language, get_current_language


AVATAR_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
ALLOWED_AVATAR_EXTS = set(AVATAR_MIME_BY_EXT)
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024


user_bp = Blueprint(
    "user",
    __name__,
    url_prefix="/users"
)


def _representative_label(user: User):
    roles = []
    if user.has_role("admin"):
        roles.append("Admin")
    if user.has_role("expert"):
        roles.append("Expert")
    if not roles:
        return None
    return f"{' & '.join(roles)} Representative"


def _notification_query(user_id: int):
    return (
        Notification.query
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )


def _paginate_notifications(query, page: int, per_page: int):
    per_page = max(10, min(per_page or 30, 50))
    page = max(page or 1, 1)
    offset = (page - 1) * per_page
    rows = query.offset(offset).limit(per_page + 1).all()
    next_page = page + 1 if len(rows) > per_page else None
    if next_page:
        rows = rows[:-1]
    return rows, next_page, per_page


# ===============================
# USER HOME
# ===============================
@user_bp.route("/")
@login_required
def index():
    """
    User dashboard / home
    """
    return render_template(
        "users/index.html",
        theme=current_user.theme
    )


# ===============================
# 🌗 UPDATE USER THEME
# ===============================
@user_bp.route("/theme", methods=["POST"])
@login_required
def update_theme():
    """
    Save user theme preference
    Accepted values: light | dark | system
    """
    data = request.get_json(silent=True) or {}
    theme = data.get("theme")

    if theme not in ("light", "dark", "system"):
        return jsonify({
            "status": "error",
            "message": "Invalid theme value"
        }), 400

    # Save preference
    current_user.theme = theme
    db.session.commit()

    return jsonify({
        "status": "success",
        "theme": theme
    })


# ===============================
# 🌐 UPDATE GLOBAL LANGUAGE
# ===============================
@user_bp.route("/language", methods=["POST"])
@login_required
def update_language():
    """
    Set global language preference for all users.
    Accepted values: en | km
    """
    data = request.get_json(silent=True) or {}
    lang = data.get("language")
    lang = set_current_language(lang)
    return jsonify({
        "status": "success",
        "language": lang
    })


# ===============================
# USER PROFILE
# ===============================
@user_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        full_name = request.form.get("full_name", "").strip()
        email_value = request.form.get("email", "").strip().lower()
        current_password = request.form.get("current_password", "")
        new_password = request.form.get("new_password", "")
        confirm_password = request.form.get("confirm_password", "")
        avatar_file = request.files.get("avatar")

        if username and username != current_user.username:
            existing = User.query.filter_by(username=username).first()
            if existing:
                flash("Username already exists.", "danger")
                return redirect(url_for("user.profile"))
            current_user.username = username

        if email_value and email_value != (current_user.email or ""):
            existing_email = (
                User.query
                .filter(User.email == email_value, User.id != current_user.id)
                .first()
            )
            if existing_email:
                flash("Email already exists.", "danger")
                return redirect(url_for("user.profile"))
            current_user.email = email_value
        elif not email_value:
            current_user.email = None

        if full_name:
            current_user.full_name = full_name
        else:
            current_user.full_name = None

        if avatar_file and avatar_file.filename:
            ext = os.path.splitext(avatar_file.filename)[1].lower()
            if ext not in ALLOWED_AVATAR_EXTS:
                flash("Invalid avatar file type.", "danger")
                return redirect(url_for("user.profile"))

            avatar_bytes = avatar_file.read() or b""
            if not avatar_bytes:
                flash("Avatar file is empty.", "danger")
                return redirect(url_for("user.profile"))
            if len(avatar_bytes) > MAX_AVATAR_SIZE_BYTES:
                flash("Avatar file is too large (max 2MB).", "danger")
                return redirect(url_for("user.profile"))

            current_user.avatar_data = avatar_bytes
            current_user.avatar_mimetype = AVATAR_MIME_BY_EXT.get(ext, "image/jpeg")
            # Keep legacy path nullable for backward compatibility; DB is source of truth.
            current_user.avatar_path = None

        if new_password or confirm_password:
            if not current_password:
                flash("Current password is required.", "danger")
                return redirect(url_for("user.profile"))
            if not current_user.check_password(current_password):
                flash("Current password is incorrect.", "danger")
                return redirect(url_for("user.profile"))
            if new_password != confirm_password:
                flash("New passwords do not match.", "danger")
                return redirect(url_for("user.profile"))
            if len(new_password) < 6:
                flash("Password must be at least 6 characters.", "danger")
                return redirect(url_for("user.profile"))
            current_user.set_password(new_password)

        db.session.commit()
        flash("Profile updated successfully.", "success")
        return redirect(url_for("user.profile"))

    rep_label = _representative_label(current_user)
    member_card_url = None
    member_card_qr_url = None
    if rep_label:
        member_card_url = url_for("user.member_card", user_id=current_user.id, _external=True)
        member_card_qr_url = (
            "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data="
            + quote_plus(member_card_url)
        )
    if current_user.has_role("admin") or current_user.has_role("expert"):
        layout_shell = "layouts/base.html"
    else:
        layout_shell = "layouts/farmer_shell.html"

    return render_template(
        "farmer/profile.html",
        rep_label=rep_label,
        member_card_url=member_card_url,
        member_card_qr_url=member_card_qr_url,
        layout_shell=layout_shell
    )


@user_bp.route("/avatar/<int:user_id>")
def avatar(user_id: int):
    user = User.query.get_or_404(user_id)

    avatar_data = getattr(user, "avatar_data", None)
    if avatar_data:
        response = send_file(
            BytesIO(avatar_data),
            mimetype=getattr(user, "avatar_mimetype", None) or "image/jpeg",
            as_attachment=False,
            max_age=0,
            conditional=False,
        )
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response

    if user.avatar_path:
        return redirect(url_for("static", filename=user.avatar_path))

    return redirect(url_for("static", filename="img/avatar.png"))


# ===============================
# MEMBER CARD (PUBLIC)
# ===============================
@user_bp.route("/member-card/<int:user_id>")
def member_card(user_id: int):
    member = User.query.get(user_id)
    if not member:
        abort(404)

    rep_label = _representative_label(member)
    if not rep_label:
        abort(404)

    role_names = ", ".join([role.name for role in member.roles])
    try:
        theme_runtime = resolve_active_runtime("admin", use_cache=True)
    except Exception:
        theme_runtime = None

    return render_template(
        "users/member_card.html",
        member=member,
        rep_label=rep_label,
        role_names=role_names,
        theme_runtime=theme_runtime,
    )


# ===============================
# USER SETTINGS
# ===============================
@user_bp.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    if request.method == "POST":
        theme = request.form.get("theme", "system")
        if theme not in ("light", "dark", "system"):
            flash("Invalid theme option.", "danger")
            return redirect(url_for("user.settings"))
        current_user.theme = theme
        
        # 🔒 Save Two-Factor Verification Toggle
        two_factor_enabled = (request.form.get("two_factor_enabled") == "y")
        current_user.two_factor_enabled = two_factor_enabled

        db.session.commit()
        flash("Settings saved.", "success")
        return redirect(url_for("user.settings"))

    if current_user.has_role("admin") or current_user.has_role("expert"):
        layout_shell = "layouts/base.html"
    else:
        layout_shell = "layouts/farmer_shell.html"

    return render_template(
        "farmer/settings.html",
        current_lang=get_current_language(),
        layout_shell=layout_shell
    )


# ===============================
# NOTIFICATIONS
# ===============================
@user_bp.route("/notifications")
@login_required
def notifications():
    page = request.args.get("page", type=int) or 1
    per_page = request.args.get("per_page", type=int) or 30

    query = _notification_query(current_user.id)
    rows, next_page, per_page = _paginate_notifications(query, page, per_page)

    template = "farmer/notifications.html" if current_user.has_role("farmer") else "users/notifications.html"
    return render_template(
        template,
        notifications_items=[serialize_notification(item) for item in rows],
        notifications_next_page=next_page,
        notifications_per_page=per_page,
    )


@user_bp.route("/notifications/data")
@login_required
def notifications_data():
    page = request.args.get("page", type=int) or 1
    per_page = request.args.get("per_page", type=int) or 30

    query = _notification_query(current_user.id)
    rows, next_page, per_page = _paginate_notifications(query, page, per_page)
    return jsonify({
        "ok": True,
        "items": [serialize_notification(item) for item in rows],
        "next_page": next_page,
    })


@user_bp.route("/notifications/seen", methods=["POST"])
@login_required
def notifications_seen():
    payload = request.get_json(silent=True) or {}
    ids = payload.get("ids") if isinstance(payload, dict) else None

    query = (
        Notification.query
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )
    if ids:
        try:
            id_list = [int(val) for val in ids]
        except (TypeError, ValueError):
            id_list = []
        if id_list:
            query = query.filter(Notification.id.in_(id_list))

    updated = query.update({"read_at": datetime.utcnow()}, synchronize_session=False)
    db.session.commit()

    unread_count = (
        Notification.query
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .count()
    )

    return jsonify({
        "ok": True,
        "updated": updated,
        "unread_count": unread_count,
    })


# ===============================
# KHMER LUNAR CALENDAR DATA
# ===============================
@user_bp.route("/khmer-calendar")
@login_required
def khmer_calendar():
    try:
        year = int(request.args.get("year", ""))
        month = int(request.args.get("month", ""))
    except ValueError:
        return jsonify({"error": "Invalid year or month"}), 400

    if month < 1 or month > 12 or year < 1900 or year > 2100:
        return jsonify({"error": "Invalid year or month"}), 400

    days = build_khmer_calendar_month(year, month)
    return jsonify({
        "year": year,
        "month": month,
        "days": days
    })


# ==========================================
# PASSKEYS MANAGEMENT ENDPOINTS 🔑
# ==========================================
@user_bp.route("/passkeys", methods=["GET"])
@login_required
def list_passkeys():
    passkeys = current_user.passkeys.all()
    return jsonify({
        "passkeys": [
            {
                "id": p.id,
                "name": p.name or "Unnamed Passkey",
                "created_at": p.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            for p in passkeys
        ]
    })


@user_bp.route("/passkeys/<int:passkey_id>", methods=["DELETE"])
@login_required
def delete_passkey(passkey_id: int):
    passkey = UserPasskey.query.filter_by(id=passkey_id, user_id=current_user.id).first_or_404()
    db.session.delete(passkey)
    db.session.commit()
    return jsonify({"status": "ok"})
