import base64
import random
import string
import datetime

from flask import Blueprint, render_template, redirect, url_for, flash, request, session, make_response, jsonify
from flask_login import login_user, current_user

from app.extensions import db
from app.models.user import User
from app.forms.auth_forms import LoginForm
from app.services.theme_manager import resolve_active_runtime
from app.services.passkey_service import (
    get_authentication_options_json,
    verify_authentication,
)
from app.blueprints.auth.routes import _send_verification_email, _safe_next_url, _sync_client_theme_to_user, _redirect_with_theme
from app.utils.audit import audit_log

staff_bp = Blueprint("staff", __name__, url_prefix="/staff")

def _resolve_staff_theme_runtime():
    scope_candidates = ["admin", "expert"]
    for scope in scope_candidates:
        try:
            runtime = resolve_active_runtime(scope, use_cache=True)
            if runtime:
                return runtime
        except Exception:
            continue
    return None

@staff_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = LoginForm()
    next_url = _safe_next_url(request.args.get("next"))
    auth_theme_runtime = _resolve_staff_theme_runtime()

    if form.validate_on_submit():
        identifier = (form.email.data or "").strip()
        user = User.query.filter(db.func.lower(User.email) == db.func.lower(identifier)).first()

        if not user or not user.check_password(form.password.data, upgrade=True):
            audit_log(
                "STAFF_LOGIN_FAILURE",
                target_user=identifier,
                detail="Invalid staff credentials",
                status="FAILURE",
                severity="WARNING",
            )
            flash("Invalid email or password.", "danger")
            return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

        if not user.is_active:
            audit_log(
                "STAFF_LOGIN_BLOCKED",
                target_user=user.username,
                user_id=user.id,
                detail="Banned staff account login attempt",
                status="BLOCKED",
                severity="WARNING",
            )
            flash("Your account has been banned. Please contact administrator.", "danger")
            return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

        if not (user.has_role("expert") or user.has_role("admin") or any(r.route_type in ["expert", "admin"] for r in user.roles)):
            flash("This login is for Expert & Admin only.", "danger")
            return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

        if not user.is_verified or user.two_factor_enabled:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()

            sent = _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login" if user.is_verified else "register"
            if sent:
                flash("Verification code sent to your email.", "info")
            else:
                flash(f"Verification code: {code} (Email delivery failed. Use this dev code to continue)", "warning")
            return redirect(url_for("auth.verify_code"))

        _sync_client_theme_to_user(user)
        db.session.commit()  # Persist any password hash upgrade.
        login_user(user, remember=False)
        audit_log(
            "STAFF_LOGIN_SUCCESS",
            target_user=user.username,
            user_id=user.id,
            detail="Staff password authentication",
        )
        flash("Welcome back!", "success")
        return _redirect_with_theme(next_url or url_for("main.index"), user)

    return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

@staff_bp.route("/passkey/login/options", methods=["GET"])
def passkey_login_options():
    try:
        options_json, challenge_str = get_authentication_options_json(request)
        session["staff_passkey_login_challenge"] = challenge_str
        return options_json, 200, {"Content-Type": "application/json"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@staff_bp.route("/passkey/login/verify", methods=["POST"])
def passkey_login_verify():
    payload = request.get_json()
    challenge_b64 = session.get("staff_passkey_login_challenge")
    if not challenge_b64:
        return {"status": "error", "message": "Staff passkey login session expired or missing challenge."}, 400

    try:
        user, passkey = verify_authentication(payload, challenge_b64, request)

        if not (user.has_role("expert") or user.has_role("admin") or any(r.route_type in ["expert", "admin"] for r in user.roles)):
            return {"status": "error", "message": "This passkey is for Staff only."}, 403

        _sync_client_theme_to_user(user)
        session.pop("staff_passkey_login_challenge", None)
        login_user(user, remember=False)
        audit_log(
            "STAFF_PASSKEY_LOGIN_SUCCESS",
            target_user=user.username,
            user_id=user.id,
            detail=f"Staff passkey '{passkey.name}' authentication",
        )
        flash("Welcome back!", "success")
        redirect_url = url_for("main.index")
        resp = make_response(jsonify({"status": "ok", "redirect_url": redirect_url}))
        if user.theme in ("light", "dark", "system"):
            resp.set_cookie("theme", user.theme, max_age=31536000, path="/", samesite="Lax")
        return resp
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400
