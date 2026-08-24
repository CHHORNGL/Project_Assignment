# app/blueprints/main/routes.py

from flask import Blueprint, redirect, url_for
from flask_login import current_user

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    # 🔐 Not logged in → login page
    if not current_user.is_authenticated:
        return redirect(url_for("auth.login"))

    # 👑 Admin / Has Admin Access
    if current_user.has_role("admin") or any(r.route_type == "admin" for r in current_user.roles):
        return redirect(url_for("admin.dashboard"))

    # 🧑‍🔬 Expert / Has Expert Access
    if current_user.has_role("expert") or any(r.route_type == "expert" for r in current_user.roles):
        return redirect(url_for("expert.dashboard"))

    # 🌾 Farmer / Has Farmer Access
    if current_user.has_role("farmer") or any(r.route_type == "farmer" for r in current_user.roles):
        return redirect(url_for("farmer.dashboard"))

    # ❓ Fallback (safety)
    return redirect(url_for("auth.logout"))
