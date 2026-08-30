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
    request,
    session
)
import random
import string
import datetime
import smtplib
from email.mime.text import MIMEText
from email.utils import make_msgid, formatdate
import os
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
from app.forms.auth_forms import LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm
from app.services.theme_manager import resolve_active_runtime


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/auth"
)


@auth_bp.before_request
def redirect_127_to_localhost():
    if "127.0.0.1" in request.host:
        new_url = request.url.replace("127.0.0.1", "localhost", 1)
        return redirect(new_url)


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


def _send_verification_email(email, code):
    subject = "Your Agri System Verification Code"
    body = f"Hello,\n\nYour verification code is: {code}\n\nThis code will expire in 10 minutes."
    
    smtp_server = os.environ.get("MAIL_SERVER")
    smtp_port = os.environ.get("MAIL_PORT")
    smtp_user = os.environ.get("MAIL_USERNAME")
    smtp_password = os.environ.get("MAIL_PASSWORD")
    smtp_sender = os.environ.get("MAIL_DEFAULT_SENDER", smtp_user or "noreply@agrisystem.com")

    if smtp_server and smtp_port and smtp_user and smtp_password:
        try:
            msg = MIMEText(body)
            msg["Subject"] = subject
            msg["From"] = smtp_sender
            msg["To"] = email
            msg["Message-ID"] = make_msgid()
            msg["Date"] = formatdate(localtime=True)

            port = int(smtp_port)
            server = smtplib.SMTP(smtp_server, port, timeout=5)
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_sender, [email], msg.as_string())
            server.quit()
            print(f"SMTP Email sent successfully to {email}")
        except Exception as e:
            print(f"SMTP failed to send email: {e}")

    # Fallback/Mock output (always printed to console/logs for debugging)
    print("*" * 80)
    print(f"  MOCK EMAIL SENT TO: {email}")
    print(f"  VERIFICATION CODE: {code}")
    print("*" * 80)


def _safe_next_url(value: Optional[str]) -> Optional[str]:
    if value and value.startswith("/"):
        return value
    return None


def _resolve_auth_theme_runtime():
    """
    Auth pages are public, so we resolve runtime server-side instead of calling
    the login-protected theme API from the browser.
    """
    scope_candidates = ["admin", "farmer"]

    for scope in scope_candidates:
        try:
            runtime = resolve_active_runtime(scope, use_cache=True)
            if runtime:
                return runtime
        except Exception:
            continue
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
    next_url = _safe_next_url(request.args.get("next"))
    auth_theme_runtime = _resolve_auth_theme_runtime()

    if form.validate_on_submit():
        email_input = (form.email.data or "").strip()
        
        # Only allow login via email, no longer allowing 'username'
        user = User.query.filter(
            db.func.lower(User.email) == db.func.lower(email_input)
        ).first()

        # ❌ Invalid email or password
        if not user or not check_password_hash(
            user.password_hash,
            form.password.data
        ):
            flash("Invalid email or password.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role="farmer",
                next_url=next_url,
                auth_theme_runtime=auth_theme_runtime,
            )

        # 🚫 BANNED USER CHECK
        if not user.is_active:
            flash("Your account has been banned. Please contact administrator.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role="farmer",
                next_url=next_url,
                auth_theme_runtime=auth_theme_runtime,
            )

        # ✅ Role gate by form
        if not (user.has_role("farmer") or any(r.route_type == "farmer" for r in user.roles)):
            flash("This login is for Farmers only.", "danger")
            return render_template(
                "auth/login.html",
                form=form,
                active_role="farmer",
                next_url=next_url,
                auth_theme_runtime=auth_theme_runtime,
            )

        # 📧 Verification Check
        if not user.is_verified:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()

            _send_verification_email(user.email, code)

            session["verify_user_id"] = user.id
            session["verify_purpose"] = "register"
            flash("Please verify your email address to complete registration. A verification code has been sent.", "info")
            return redirect(url_for("auth.verify_code"))

        # 🔐 Two-Step Verification Check (for all users)
        if user.two_factor_enabled:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()

            _send_verification_email(user.email, code)

            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login"
            flash("Two-step verification code has been sent to your Gmail/Email address.", "info")
            return redirect(url_for("auth.verify_code"))

        # ✅ Login success
        login_user(user, remember=True)
        flash("Welcome back!", "success")
        return redirect(next_url or url_for("main.index"))

    return render_template(
        "auth/login.html",
        form=form,
        active_role="farmer",
        next_url=next_url,
        auth_theme_runtime=auth_theme_runtime,
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
    auth_theme_runtime = _resolve_auth_theme_runtime()

    if form.validate_on_submit():
        email_value = form.email.data.strip().lower()
        if User.query.filter_by(email=email_value).first():
            flash("Email already exists.", "danger")
            return render_template(
                "auth/register.html",
                form=form,
                auth_theme_runtime=auth_theme_runtime,
            )

        # Validate OTP from session
        input_code = form.verification_code.data.strip()
        session_email = session.get("register_otp_email")
        session_code = session.get("register_otp_code")
        session_expiry = session.get("register_otp_expiry")

        if not session_code or not session_email or email_value != session_email:
            flash("Please request a new verification code for this email.", "danger")
            return render_template("auth/register.html", form=form, auth_theme_runtime=auth_theme_runtime)

        if input_code != session_code:
            flash("Invalid verification code.", "danger")
            return render_template("auth/register.html", form=form, auth_theme_runtime=auth_theme_runtime)

        if session_expiry and datetime.datetime.utcnow().timestamp() > session_expiry:
            flash("Verification code has expired. Please request a new one.", "danger")
            return render_template("auth/register.html", form=form, auth_theme_runtime=auth_theme_runtime)

        # ✅ Generate a unique username from email prefix
        email_prefix = email_value.split("@")[0]
        generated_username = _unique_username(email_prefix)

        # ✅ Create farmer user (verified immediately)
        user = User(username=generated_username, is_active=True, is_verified=True)
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

        # Clear OTP session
        session.pop("register_otp_email", None)
        session.pop("register_otp_code", None)
        session.pop("register_otp_expiry", None)

        login_user(user, remember=True)
        flash("Registration successful! Welcome to Agri System.", "success")
        return redirect(url_for("main.index"))

    return render_template(
        "auth/register.html",
        form=form,
        auth_theme_runtime=auth_theme_runtime,
    )

@auth_bp.route("/send-register-otp", methods=["POST"])
def send_register_otp():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    
    if not email or "@" not in email:
        return {"success": False, "message": "Please enter a valid email address"}
        
    if User.query.filter_by(email=email).first():
        return {"success": False, "message": "This email is already registered"}
        
    code = "".join(random.choices(string.digits, k=6))
    session["register_otp_email"] = email
    session["register_otp_code"] = code
    session["register_otp_expiry"] = datetime.datetime.utcnow().timestamp() + 600
    
    import os
    if os.environ.get("MAIL_USERNAME") == "your_gmail_address_here@gmail.com" or not os.environ.get("MAIL_USERNAME"):
        return {"success": False, "message": "SMTP not configured! Open .env and add your MAIL_USERNAME and MAIL_PASSWORD."}
        
    _send_verification_email(email, code)
    return {"success": True, "message": "Verification code sent to your email"}

# ==================================================
# FORGOT PASSWORD
# ==================================================
@auth_bp.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    form = ForgotPasswordForm()
    auth_theme_runtime = _resolve_auth_theme_runtime()

    if form.validate_on_submit():
        email = form.email.data.strip().lower()
        user = User.query.filter_by(email=email).first()

        if user and user.is_active:
            # Generate OTP code
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()

            # Send OTP email
            _send_verification_email(user.email, code)

            # Store reset context in session
            session["reset_password_user_id"] = user.id
            flash("An OTP code has been sent to your email address.", "info")
            return redirect(url_for("auth.reset_password"))
        else:
            # Show same message to prevent email enumeration
            flash("If an active account exists with that email, an OTP code has been sent.", "info")
            # If user not found, still redirect to reset password, they just won't be able to succeed.
            # But realistically, maybe we should redirect to login.
            return redirect(url_for("auth.login"))

    return render_template(
        "auth/forgot_password.html",
        form=form,
        auth_theme_runtime=auth_theme_runtime,
    )

@auth_bp.route("/reset-password", methods=["GET", "POST"])
def reset_password():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    user_id = session.get("reset_password_user_id")
    if not user_id:
        flash("Session expired or invalid. Please start the password reset process again.", "danger")
        return redirect(url_for("auth.forgot_password"))

    user = User.query.get(user_id)
    if not user:
        flash("Invalid reset session.", "danger")
        return redirect(url_for("auth.forgot_password"))

    form = ResetPasswordForm()
    auth_theme_runtime = _resolve_auth_theme_runtime()

    if form.validate_on_submit():
        input_code = form.code.data.strip()

        # Validate OTP
        if not user.two_factor_code or user.two_factor_code != input_code:
            flash("Invalid OTP code.", "danger")
            return render_template("auth/reset_password.html", form=form, email=user.email, auth_theme_runtime=auth_theme_runtime)

        # Check expiry
        if user.two_factor_expiry and user.two_factor_expiry < datetime.datetime.utcnow():
            flash("OTP code has expired. Please request a new one.", "danger")
            return redirect(url_for("auth.forgot_password"))

        # Update password
        user.set_password(form.password.data)
        user.two_factor_code = None
        user.two_factor_expiry = None
        db.session.commit()

        session.pop("reset_password_user_id", None)
        flash("Your password has been successfully reset. You can now log in.", "success")
        return redirect(url_for("auth.login"))

    return render_template(
        "auth/reset_password.html",
        form=form,
        email=user.email,
        auth_theme_runtime=auth_theme_runtime,
    )

# ==================================================
# LOGOUT
# ==================================================
@auth_bp.route("/logout")
def logout():
    logout_user()
    session.pop("verify_user_id", None)
    session.pop("verify_purpose", None)
    flash("Logged out successfully.", "info")
    return redirect(url_for("auth.login", role="farmer"))


@auth_bp.route("/verify-code", methods=["GET", "POST"])
def verify_code():
    if current_user.is_authenticated:
        return redirect(url_for("main.index"))

    user_id = session.get("verify_user_id")
    purpose = session.get("verify_purpose")
    if not user_id:
        flash("Session expired. Please log in again.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    user = User.query.get(user_id)
    if not user:
        flash("User not found.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    if request.method == "POST":
        input_code = (request.form.get("code") or "").strip()
        if not user.two_factor_code or user.two_factor_code != input_code:
            flash("Invalid verification code.", "danger")
            return render_template("auth/verify_code.html", email=user.email, purpose=purpose)

        # Check expiry
        if user.two_factor_expiry and user.two_factor_expiry < datetime.datetime.utcnow():
            flash("Verification code has expired. Please request a new one.", "danger")
            return render_template("auth/verify_code.html", email=user.email, purpose=purpose)

        # Success: verify and clear
        user.two_factor_code = None
        user.two_factor_expiry = None
        if purpose == "register":
            user.is_verified = True

        db.session.commit()

        # Log in the user
        login_user(user, remember=True)

        session.pop("verify_user_id", None)
        session.pop("verify_purpose", None)

        flash("Authentication successful!", "success")
        return redirect(url_for("main.index"))

    return render_template("auth/verify_code.html", email=user.email, purpose=purpose)


@auth_bp.route("/resend-code", methods=["POST"])
def resend_code():
    user_id = session.get("verify_user_id")
    if not user_id:
        flash("Session expired.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    user = User.query.get(user_id)
    if not user:
        flash("User not found.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    code = "".join(random.choices(string.digits, k=6))
    user.two_factor_code = code
    user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    db.session.commit()

    _send_verification_email(user.email, code)
    flash("A new verification code has been sent to your Gmail/Email address.", "success")
    return redirect(url_for("auth.verify_code"))


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
        resp = google.get("https://www.googleapis.com/oauth2/v3/userinfo")
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
            google_sub=google_sub,
            is_active=True
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

    if user.is_active is False:
        flash("Your account has been banned. Please contact administrator.", "danger")
        return redirect(url_for("auth.login", role="farmer"))

    db.session.commit()

    # 🔐 Two-Step Verification Check (for all users, including OAuth connections)
    if user.two_factor_enabled:
        code = "".join(random.choices(string.digits, k=6))
        user.two_factor_code = code
        user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.session.commit()

        _send_verification_email(user.email, code)

        session["verify_user_id"] = user.id
        session["verify_purpose"] = "login"
        flash("Two-step verification code has been sent to your Gmail/Email address.", "info")
        return redirect(url_for("auth.verify_code"))

    login_user(user, remember=True)
    flash("Welcome back!", "success")
    return redirect(url_for("main.index"))


# ==========================================
# WEBAUTHN PASSKEYS ROUTES 🔑
# ==========================================
import base64
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    RegistrationCredential,
    AuthenticationCredential
)
from app.models.passkey import UserPasskey

@auth_bp.route("/passkey/register/options", methods=["GET"])
@login_required
def passkey_register_options():
    rp_id = request.host.split(":")[0]
    user_id = str(current_user.id).encode("utf-8")
    
    options = generate_registration_options(
        rp_id=rp_id,
        rp_name="Agri System",
        user_id=user_id,
        user_name=current_user.username,
        user_display_name=current_user.full_name or current_user.username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED
        )
    )
    session["passkey_registration_challenge"] = base64.b64encode(options.challenge).decode("utf-8")
    return options_to_json(options)

@auth_bp.route("/passkey/register/verify", methods=["POST"])
@login_required
def passkey_register_verify():
    payload = request.get_json()
    expected_challenge = base64.b64decode(session.get("passkey_registration_challenge", ""))
    
    try:
        registration_verification = verify_registration_response(
            credential=RegistrationCredential.parse_obj(payload),
            expected_challenge=expected_challenge,
            expected_rp_id=request.host.split(":")[0],
            expected_origin=request.host_url.rstrip("/"),
        )
        
        # Save to db
        passkey = UserPasskey(
            user_id=current_user.id,
            credential_id=registration_verification.credential_id,
            public_key=registration_verification.public_key,
            sign_count=registration_verification.sign_count,
            name=payload.get("name") or "My Passkey"
        )
        db.session.add(passkey)
        db.session.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/passkey/login/options", methods=["GET"])
def passkey_login_options():
    rp_id = request.host.split(":")[0]
    options = generate_authentication_options(
        rp_id=rp_id,
        user_verification=UserVerificationRequirement.PREFERRED
    )
    session["passkey_login_challenge"] = base64.b64encode(options.challenge).decode("utf-8")
    return options_to_json(options)

@auth_bp.route("/passkey/login/verify", methods=["POST"])
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
         
    if not (user.has_role("farmer") or any(r.route_type == "farmer" for r in user.roles)):
         return {"status": "error", "message": "This passkey is for Farmers only."}, 403
         
    expected_challenge = base64.b64decode(session.get("passkey_login_challenge", ""))
    
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
        
        login_user(user, remember=True)
        flash("Logged in successfully via Passkey!", "success")
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/reset-password-api", methods=["POST"])
def reset_password_api():
    data = request.get_json()
    action = data.get("action")

    if action == "send_code":
        email = (data.get("email") or "").strip().lower()
        user = User.query.filter_by(email=email).first()
        if user and user.is_active:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()
            _send_verification_email(user.email, code)
            return {"success": True, "message": "OTP sent"}
        return {"success": True, "message": "If account exists, OTP sent"} # Prevent email enum

    elif action == "verify_code":
        email = (data.get("email") or "").strip().lower()
        input_code = (data.get("code") or "").strip()
        user = User.query.filter_by(email=email).first()
        if not user or not user.two_factor_code or user.two_factor_code != input_code:
            return {"success": False, "message": "Invalid OTP code"}
        if user.two_factor_expiry and user.two_factor_expiry < datetime.datetime.utcnow():
            return {"success": False, "message": "OTP expired"}
        return {"success": True, "message": "OTP verified"}

    elif action == "reset_password":
        email = (data.get("email") or "").strip().lower()
        input_code = (data.get("code") or "").strip()
        new_password = data.get("password")
        user = User.query.filter_by(email=email).first()
        if not user or not user.two_factor_code or user.two_factor_code != input_code:
            return {"success": False, "message": "Invalid OTP code"}
        
        user.set_password(new_password)
        user.two_factor_code = None
        user.two_factor_expiry = None
        db.session.commit()
        return {"success": True, "message": "Password reset successfully"}

    return {"success": False, "message": "Unknown action"}, 400
