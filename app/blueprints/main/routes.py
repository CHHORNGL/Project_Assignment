# app/blueprints/main/routes.py

from flask import Blueprint, redirect, url_for
from flask_login import current_user

main_bp = Blueprint("main", __name__)

@main_bp.route("/")
def index():
    # 🔐 Not logged in → login page
    if not current_user.is_authenticated:
        return redirect(url_for("auth.login"))

    # 👑 Admin → Admin dashboard
    if current_user.has_role("admin"):
        return redirect(url_for("admin.dashboard"))

    # 🧑‍🔬 Expert → Expert main form/dashboard
    if current_user.has_role("expert"):
        return redirect(url_for("expert.dashboard"))

    # 🌾 Farmer → Farmer dashboard
    if current_user.has_role("farmer"):
        return redirect(url_for("farmer.dashboard"))

    # ❓ Fallback (safety – avoid infinite loop)
    return redirect(url_for("auth.logout"))
