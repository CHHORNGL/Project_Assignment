import base64
import random
import string
import datetime

from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from flask_login import login_user, current_user
from werkzeug.security import check_password_hash

from webauthn import (
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers.structs import (
    UserVerificationRequirement,
    AuthenticationCredential
)

from app.extensions import db
from app.models.user import User
from app.models.passkey import UserPasskey
from app.forms.auth_forms import LoginForm
from app.services.theme_manager import resolve_active_runtime
from app.blueprints.auth.routes import _send_verification_email, _safe_next_url

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

        if not user or not check_password_hash(user.password_hash, form.password.data):
            flash("Invalid email or password.", "danger")
            return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

        if not user.is_active:
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

            _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login" if user.is_verified else "register"
            flash("Verification code sent to your email.", "info")
            return redirect(url_for("auth.verify_code"))

        login_user(user)
        flash("Welcome back!", "success")
        return redirect(next_url or url_for("main.index"))

    return render_template("staff/login.html", form=form, active_role="expert", next_url=next_url, auth_theme_runtime=auth_theme_runtime)

@staff_bp.route("/passkey/login/options", methods=["GET"])
def passkey_login_options():
    rp_id = request.host.split(":")[0]
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.PREFERRED
    )
    session["staff_passkey_login_challenge"] = base64.b64encode(options.challenge).decode("utf-8")
    return options_to_json(options)

@staff_bp.route("/passkey/login/verify", methods=["POST"])
def passkey_login_verify():
    payload = request.get_json()
    credential_id = payload.get("id")
    
    passkey = UserPasskey.query.filter_by(credential_id=credential_id).first()
    if not passkey:
         return {"status": "error", "message": "Passkey not registered on this server"}, 400
         
    user = User.query.get(passkey.user_id)
    if not user:
         return {"status": "error", "message": "User not found"}, 400
    if not user.is_active:
         return {"status": "error", "message": "User is inactive"}, 400
         
    if not (user.has_role("expert") or user.has_role("admin") or any(r.route_type in ["expert", "admin"] for r in user.roles)):
         return {"status": "error", "message": "This passkey is for Staff only."}, 403
         
    expected_challenge = base64.b64decode(session.get("staff_passkey_login_challenge", ""))
    
    try:
        auth_verification = verify_authentication_response(
            credential=AuthenticationCredential.parse_obj(payload),
            expected_challenge=expected_challenge,
            expected_rp_id=request.host.split(":")[0],
            expected_origin=request.host_url.rstrip("/"),
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
        )
        
        passkey.sign_count = auth_verification.new_sign_count
        db.session.commit()
        
        login_user(user)
        flash("Logged in successfully via Passkey!", "success")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400
