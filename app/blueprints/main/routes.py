# app/blueprints/main/routes.py

from flask import Blueprint, redirect, url_for, request, session
from flask_login import current_user

main_bp = Blueprint("main", __name__)


def _redirect_with_theme(target_url, user=None):
    resp = redirect(target_url)
    theme = (getattr(user, "theme", None) if user else None) or request.cookies.get("theme") or session.get("theme")
    if theme in ("light", "dark", "system"):
        resp.set_cookie("theme", theme, max_age=31536000, path="/", samesite="Lax")
    return resp


@main_bp.route("/")
def index():
    # 🔐 Not logged in → go to farmer dashboard as guest
    if not current_user.is_authenticated:
        return _redirect_with_theme(url_for("farmer.dashboard"))

    # 👑 Admin / Has Admin Access
    if current_user.has_role("admin") or any(r.route_type == "admin" for r in current_user.roles):
        return _redirect_with_theme(url_for("admin.dashboard"), current_user)

    # 🧑‍🔬 Expert / Has Expert Access
    if current_user.has_role("expert") or any(r.route_type == "expert" for r in current_user.roles):
        return _redirect_with_theme(url_for("expert.dashboard"), current_user)

    # 🌾 Farmer / Has Farmer Access
    if current_user.has_role("farmer") or any(r.route_type == "farmer" for r in current_user.roles):
        return _redirect_with_theme(url_for("farmer.dashboard"), current_user)

    # ❓ Fallback (safety)
    return redirect(url_for("auth.logout"))
