# app/blueprints/auth/routes.py

import re
import secrets
from typing import Optional

from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    flash,
    request
)
from flask_login import (
    login_user,
    logout_user,
    current_user,
    login_required
)
from werkzeug.security import check_password_hash
from sqlalchemy import or_

from app.extensions import db, oauth
from app.models.user import User
from app.models.role import Role
from app.forms.auth_forms import LoginForm, RegisterForm


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth"
)


def _get_google_client():
    return oauth.create_client("google")


def _slugify_username(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_]+", "", value)
    return value or "user"


def _unique_username(base: str) -> str:
    base = _slugify_username(base)
    candidate = base
    counter = 1
    while User.query.filter_by(username=candidate).first():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate


def _normalize_login_role(value: Optional[str]) -> str:
    role = (value or "").strip().lower()
    if role in {"farmer", "expert"}:
        return role
    return "farmer"


def _safe_next_url(value: Optional[str]) -> Optional[str]:
    if value and value.startswith("/"):
        return value
    return None


# ==================================================
# LOGIN
# ==================================================
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    # 🔐 Already logged in → let main router decide
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = LoginForm()
    active_role = _normalize_login_role(request.args.get("role"))
    next_url = _safe_next_url(request.args.get("next"))

    if form.validate_on_submit():
        identifier = (form.username.data or "").strip()
        user = User.query.filter(
            or_(
                User.username == identifier,
                User.email == identifier
            )
        ).first()

        # ❌ Invalid username or password
        if not user or not check_password_hash(
            user.password_hash,
            form.password.data
        ):
            flash("Invalid username or password.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role=active_role,
                next_url=next_url
            )

        # 🚫 BANNED USER CHECK
        if not user.is_active:
            flash("Your account has been banned. Please contact administrator.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role=active_role,
                next_url=next_url
            )

        # ✅ Role gate by form
        if active_role == "farmer" and not user.has_role("farmer"):
            flash("This login is for Farmers only.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role=active_role,
                next_url=next_url
            )

        if active_role == "expert" and not (
            user.has_role("expert") or user.has_role("admin")
        ):
            flash("This login is for Expert & Admin only.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role=active_role,
                next_url=next_url
            )

        # ✅ Login success
        login_user(user)
        flash("Welcome back!", "success")

        # 🔁 Centralized redirect (role-based in main.index)
        return redirect(next_url or url_for("main.index"))

    return render_template(
        "auth/login.html",
        form=form,
        active_role=active_role,
        next_url=next_url
    )


# ==================================================
# REGISTER (FARMER ONLY)
# ==================================================
@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    # 🔐 Block logged-in users
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = RegisterForm()

    if form.validate_on_submit():
        # ❌ Username exists
        if User.query.filter_by(username=form.username.data).first():
            flash("Username already exists.", "danger")
            return render_template(
                "auth/register.html",
                form=form
            )

        email_value = (form.email.data or "").strip().lower()
        if email_value and User.query.filter_by(email=email_value).first():
            flash("Email already exists.", "danger")
            return render_template(
                "auth/register.html",
                form=form
            )

        # ✅ Create farmer user
        user = User(username=form.username.data)
        full_name_value = (form.full_name.data or "").strip()
        if full_name_value:
            user.full_name = full_name_value
        if email_value:
            user.email = email_value
        user.set_password(form.password.data)

        farmer_role = Role.query.filter_by(name="farmer").first()
        if not farmer_role:
            flash("Farmer role not found. Contact admin.", "danger")
            return redirect(url_for("auth.register"))

        user.roles.append(farmer_role)

        db.session.add(user)
        db.session.commit()

        flash("Registration successful. Please log in.", "success")
        return redirect(url_for("auth.login", role="farmer"))

    return render_template(
        "auth/register.html",
        form=form
    )


# ==================================================
# LOGOUT
# ==================================================
@auth_bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Logged out successfully.", "info")
    return redirect(url_for("auth.login", role="farmer"))


# ==================================================
# GOOGLE OAUTH
# ==================================================
@auth_bp.route("/google")
def google_login():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    google = _get_google_client()
    if not google:
        flash("Google login is not configured yet.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    redirect_uri = url_for("auth.google_callback", _external=True)
    return google.authorize_redirect(redirect_uri)


@auth_bp.route("/google/callback")
def google_callback():
    google = _get_google_client()
    if not google:
        flash("Google login is not configured yet.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    try:
        token = google.authorize_access_token()
    except Exception:
        flash("Google login failed. Please try again.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    user_info = None
    try:
        user_info = google.parse_id_token(token)
    except Exception:
        user_info = None

    if not user_info:
        resp = google.get("userinfo")
        if resp and resp.ok:
            user_info = resp.json()

    if not user_info:
        flash("Unable to read Google profile information.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    google_sub = user_info.get("sub")
    email = user_info.get("email")
    display_name = user_info.get("name") or (email.split("@")[0] if email else "user")

    if not google_sub:
        flash("Google login failed. Missing account identifier.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    user = User.query.filter_by(google_sub=google_sub).first()

    if not user and email:
        user = User.query.filter_by(email=email).first()
        if user and not user.google_sub:
            user.google_sub = google_sub
            if not user.full_name and display_name:
                user.full_name = display_name

    if not user:
        user = User(
            username=_unique_username(display_name),
            email=email,
            google_sub=google_sub
        )
        if display_name:
            user.full_name = display_name
        user.set_password(secrets.token_urlsafe(16))

        farmer_role = Role.query.filter_by(name="farmer").first()
        if not farmer_role:
            flash("Farmer role not found. Contact admin.", "danger")
            return redirect(url_for("auth.login", role="farmer"))
        user.roles.append(farmer_role)

        db.session.add(user)

    if not user.is_active:
        flash("Your account has been banned. Please contact administrator.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    db.session.commit()
    login_user(user)
    flash("Welcome back!", "success")
    return redirect(url_for("main.index"))
