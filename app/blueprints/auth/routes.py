from app.utils.input_validation import text_field, email_field, password_field, code_field, safe_next_url, InputValidationError
from app.utils.audit import audit_log
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
    session,
    jsonify,
    make_response,
)
import random
import string
import datetime
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import make_msgid, formatdate
import os
from flask_login import (
    login_user,
    logout_user,
    current_user,
    login_required
)
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


def _send_verification_email(email: str, code: str) -> bool:
    subject = "Your Agri System Verification Code"
    plain_body = (
        f"Hello,\n\n"
        f"Your verification code is: {code}\n\n"
        f"This code will expire in 10 minutes.\n\n"
        f"If you did not request this code, please ignore this email.\n"
    )
    html_body = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #16a34a; margin: 0; font-size: 22px; letter-spacing: 0.5px;">AGRI SYSTEM</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Smart Agricultural Management</p>
        </div>
        <div style="padding: 16px 0; text-align: center;">
            <p style="color: #334155; font-size: 15px; margin-bottom: 16px;">Here is your single-use verification code:</p>
            <div style="display: inline-block; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 10px; padding: 12px 28px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #15803d; font-family: monospace;">
                {code}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-top: 16px;">This code will expire in <strong>10 minutes</strong>.</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
            If you did not request this verification code, please ignore this email or contact support.
        </p>
    </div>
</body>
</html>"""

    brevo_api_key = (os.environ.get("BREVO_API_KEY") or os.environ.get("MAIL_API_KEY") or "").strip()
    smtp_server = (os.environ.get("MAIL_SERVER") or "").strip()
    smtp_port_raw = (os.environ.get("MAIL_PORT") or "").strip()
    smtp_user = (os.environ.get("MAIL_USERNAME") or "").strip()
    smtp_password = (os.environ.get("MAIL_PASSWORD") or "").strip()
    smtp_sender = (os.environ.get("MAIL_DEFAULT_SENDER") or smtp_user or "noreply@agrisystem.com").strip()

    email_sent = False
    error_detail = None
    delivery_method = None

    # Method 1: Brevo HTTPS API (Port 443 - never blocked by cloud firewalls like Railway)
    if brevo_api_key:
        try:
            import urllib.request
            import json
            api_url = "https://api.brevo.com/v3/smtp/email"
            req_headers = {
                "accept": "application/json",
                "api-key": brevo_api_key,
                "content-type": "application/json"
            }
            req_payload = {
                "sender": {"name": "Agri System", "email": smtp_sender},
                "to": [{"email": email}],
                "subject": subject,
                "htmlContent": html_body,
                "textContent": plain_body
            }
            req = urllib.request.Request(
                api_url,
                data=json.dumps(req_payload).encode("utf-8"),
                headers=req_headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    email_sent = True
                    delivery_method = "BREVO_HTTPS_API"
                    print(f"[MAIL SUCCESS] Verification email sent via Brevo HTTPS API to {email}")
        except Exception as e:
            error_detail = f"Brevo API error: {e}"
            print(f"[MAIL API ERROR] Brevo API failed: {e}")

    # Method 2: Standard SMTP (Port 587/465 fallback for local dev / unblocked hosts)
    if not email_sent and smtp_server and smtp_port_raw and smtp_user and smtp_password and smtp_user != "your_gmail_address_here@gmail.com":
        try:
            port = int(smtp_port_raw)
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_sender
            msg["To"] = email
            msg["Message-ID"] = make_msgid()
            msg["Date"] = formatdate(localtime=True)

            msg.attach(MIMEText(plain_body, "plain", "utf-8"))
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            if port == 465:
                server = smtplib.SMTP_SSL(smtp_server, port, timeout=12)
            else:
                server = smtplib.SMTP(smtp_server, port, timeout=12)
                server.starttls()

            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_sender, [email], msg.as_string())
            server.quit()
            email_sent = True
            delivery_method = f"SMTP ({smtp_server}:{port})"
            print(f"[MAIL SUCCESS] SMTP Verification email sent successfully to {email}")
        except Exception as e:
            error_detail = str(e)
            print(f"[MAIL ERROR] SMTP failed to send email to {email}: {e}")
    elif not email_sent and not error_detail:
        error_detail = "Neither Brevo API key nor SMTP credentials configured"

    # Fallback/Mock output (always printed to console/logs for debugging)
    print("*" * 80)
    print(f"  VERIFICATION CODE FOR: {email}")
    print(f"  CODE: {code}")
    if email_sent:
        print(f"  DELIVERY STATUS: SENT VIA {delivery_method}")
    else:
        print(f"  DELIVERY STATUS: NOT SENT VIA SMTP/API ({error_detail})")
    print("*" * 80)

    return email_sent


def _safe_next_url(value: Optional[str]) -> Optional[str]:
    return safe_next_url(value)


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


def _sync_client_theme_to_user(user):
    """
    Sync client theme preference (from cookie, session, or request body)
    to the authenticated user record in the database so that guest preferences
    seamlessly follow the user across login.
    """
    client_theme = request.cookies.get("theme") or session.get("theme")
    if not client_theme and request.is_json:
        data = request.get_json(silent=True) or {}
        client_theme = data.get("theme")
    if client_theme in ("light", "dark", "system") and user:
        if getattr(user, "theme", None) != client_theme:
            user.theme = client_theme
            db.session.commit()


def _redirect_with_theme(target_url, user=None):
    """
    Redirect helper ensuring the active theme cookie is set in the HTTP response.
    """
    resp = redirect(target_url)
    theme = (getattr(user, "theme", None) if user else None) or request.cookies.get("theme") or session.get("theme")
    if theme in ("light", "dark", "system"):
        resp.set_cookie("theme", theme, max_age=31536000, path="/", samesite="Lax")
    return resp



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
        if not user or not user.check_password(form.password.data, upgrade=True):
            audit_log(
                "AUTH_LOGIN_FAILURE",
                target_user=email_input,
                detail="Invalid credentials",
                status="FAILURE",
                severity="WARNING",
            )
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
            audit_log(
                "AUTH_LOGIN_BLOCKED",
                target_user=user.username,
                user_id=user.id,
                detail="Banned account login attempt",
                status="BLOCKED",
                severity="WARNING",
            )
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

            sent = _send_verification_email(user.email, code)

            session["verify_user_id"] = user.id
            session["verify_purpose"] = "register"
            if sent:
                flash("Please verify your email address to complete registration. A verification code has been sent.", "info")
            else:
                flash(f"Verification code: {code} (Email delivery failed. Use this dev code to continue)", "warning")
            return redirect(url_for("auth.verify_code"))

        # 🔐 Two-Step Verification Check (for all users)
        if user.two_factor_enabled:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()

            sent = _send_verification_email(user.email, code)

            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login"
            if sent:
                flash("Two-step verification code has been sent to your Gmail/Email address.", "info")
            else:
                flash(f"Two-step verification code: {code} (Email delivery failed. Use this dev code to continue)", "warning")
            return redirect(url_for("auth.verify_code"))

        # ✅ Login success
        _sync_client_theme_to_user(user)
        db.session.commit()  # Persist any password hash upgrade.
        login_user(user, remember=False)
        audit_log(
            "AUTH_LOGIN_SUCCESS",
            target_user=user.username,
            user_id=user.id,
            detail="Farmer password authentication",
        )
        flash("Welcome back!", "success")
        return _redirect_with_theme(next_url or url_for("main.index"), user)

    return render_template(
        "auth/login.html",
        form=form,
        active_role="farmer",
        next_url=next_url,
        auth_theme_runtime=auth_theme_runtime,
    )


@auth_bp.route("/ajax-login", methods=["POST"])
def ajax_login():
    if current_user.is_authenticated:
        return {"success": True, "redirect": url_for("farmer.dashboard")}

    data = request.get_json() or {}
    email_input = (data.get("email") or "").strip()
    password_input = data.get("password") or ""
    remember = bool(data.get("remember", False))

    if not email_input or not password_input:
        return {"success": False, "message": "Please enter both email and password."}, 400

    user = User.query.filter(
        db.func.lower(User.email) == db.func.lower(email_input)
    ).first()

    if not user or not user.check_password(password_input, upgrade=True):
        audit_log(
            "AUTH_LOGIN_FAILURE",
            target_user=email_input,
            detail="AJAX invalid credentials",
            status="FAILURE",
            severity="WARNING",
        )
        return {"success": False, "message": "Invalid email or password."}, 401

    if not user.is_active:
        audit_log(
            "AUTH_LOGIN_BLOCKED",
            target_user=user.username,
            user_id=user.id,
            detail="Banned account login attempt",
            status="BLOCKED",
            severity="WARNING",
        )
        return {"success": False, "message": "Your account has been deactivated. Please contact administrator."}, 403

    has_farmer_access = (
        user.has_role("farmer")
        or user.has_role("admin")
        or any(r.route_type in ("farmer", "admin") for r in user.roles)
    )
    if not has_farmer_access:
        return {"success": False, "message": "This login is for Farmers only."}, 403

    # Verification Check
    if not user.is_verified:
        code = "".join(random.choices(string.digits, k=6))
        user.two_factor_code = code
        user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.session.commit()
        sent = _send_verification_email(user.email, code)
        session["verify_user_id"] = user.id
        session["verify_purpose"] = "register"
        return {
            "success": False,
            "require_verify": True,
            "redirect": url_for("auth.verify_code"),
            "message": "Please verify your email address to continue." if sent else f"Verification code: {code} (Email delivery failed)",
            "dev_code": code if not sent else None
        }

    # 2FA Check
    if user.two_factor_enabled:
        code = "".join(random.choices(string.digits, k=6))
        user.two_factor_code = code
        user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
        db.session.commit()
        sent = _send_verification_email(user.email, code)
        session["verify_user_id"] = user.id
        session["verify_purpose"] = "login"
        return {
            "success": False,
            "require_2fa": True,
            "redirect": url_for("auth.verify_code"),
            "message": "Two-factor verification required." if sent else f"Two-factor code: {code} (Email delivery failed)",
            "dev_code": code if not sent else None
        }

    _sync_client_theme_to_user(user)
    db.session.commit()
    login_user(user, remember=remember)
    audit_log(
        "AUTH_LOGIN_SUCCESS",
        target_user=user.username,
        user_id=user.id,
        detail="Farmer in-page AJAX login",
    )
    resp = make_response(jsonify({
        "success": True,
        "message": "Welcome back!",
        "redirect": url_for("farmer.dashboard")
    }))
    if user.theme in ("light", "dark", "system"):
        resp.set_cookie("theme", user.theme, max_age=31536000, path="/", samesite="Lax")
    return resp


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

        _sync_client_theme_to_user(user)
        login_user(user, remember=False)
        flash("Registration successful! Welcome to Agri System.", "success")
        return _redirect_with_theme(url_for("main.index"), user)

    return render_template(
        "auth/register.html",
        form=form,
        auth_theme_runtime=auth_theme_runtime,
    )


@auth_bp.route("/ajax-register", methods=["POST"])
def ajax_register():
    if current_user.is_authenticated:
        return {"success": True, "redirect": url_for("farmer.dashboard")}

    data = request.get_json() or {}
    full_name = (data.get("full_name") or "").strip()
    email_value = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    verification_code = (data.get("verification_code") or "").strip()

    if not email_value or "@" not in email_value or "." not in email_value:
        return {"success": False, "message": "Please enter a valid email address."}, 400

    if not password or len(password) < 6:
        return {"success": False, "message": "Password must be at least 6 characters."}, 400

    if User.query.filter_by(email=email_value).first():
        return {"success": False, "message": "An account with this email already exists. Please sign in instead."}, 400

    # If verification OTP was requested and stored in session, validate it
    session_email = session.get("register_otp_email")
    session_code = session.get("register_otp_code")
    session_expiry = session.get("register_otp_expiry")
    if verification_code:
        if not session_code or session_email != email_value or verification_code != session_code:
            return {"success": False, "message": "Invalid verification code."}, 400
        if session_expiry and datetime.datetime.utcnow().timestamp() > session_expiry:
            return {"success": False, "message": "Verification code has expired. Please request a new one."}, 400
    elif session_code and session_email == email_value:
        return {"success": False, "message": "Please enter the verification code sent to your email."}, 400

    # Generate unique username from email
    email_prefix = email_value.split("@")[0]
    generated_username = _unique_username(email_prefix)

    # Create farmer user (active & verified)
    user = User(
        username=generated_username,
        full_name=full_name or email_prefix.title(),
        email=email_value,
        is_active=True,
        is_verified=True,
    )
    user.set_password(password)

    farmer_role = Role.query.filter_by(name="farmer").first()
    if not farmer_role:
        farmer_role = Role(name="farmer", route_type="farmer")
        db.session.add(farmer_role)
        db.session.commit()

    user.roles.append(farmer_role)
    db.session.add(user)
    db.session.commit()

    # Clear OTP session
    session.pop("register_otp_email", None)
    session.pop("register_otp_code", None)
    session.pop("register_otp_expiry", None)

    _sync_client_theme_to_user(user)
    login_user(user, remember=False)
    audit_log(
        "AUTH_REGISTER_SUCCESS",
        target_user=user.username,
        user_id=user.id,
        detail="Farmer in-page AJAX registration",
    )
    resp = make_response(jsonify({
        "success": True,
        "message": "Registration successful! Welcome to AgriSystem.",
        "redirect": url_for("farmer.dashboard")
    }))
    if user.theme in ("light", "dark", "system"):
        resp.set_cookie("theme", user.theme, max_age=31536000, path="/", samesite="Lax")
    return resp


@auth_bp.route("/send-register-otp", methods=["POST"])
def send_register_otp():
    data = request.get_json() or {}
    email = email_field(data)

    if User.query.filter_by(email=email).first():
        return {"success": False, "message": "This email is already registered. Please sign in instead."}

    code = "".join(random.choices(string.digits, k=6))
    session["register_otp_email"] = email
    session["register_otp_code"] = code
    session["register_otp_expiry"] = datetime.datetime.utcnow().timestamp() + 600

    sent = _send_verification_email(email, code)
    if sent:
        return {"success": True, "message": "Verification code sent to your email"}
    return {"success": True, "message": f"Verification code generated (Dev Code: {code})", "code": code}

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
            sent = _send_verification_email(user.email, code)

            # Store reset context in session
            session["reset_password_user_id"] = user.id
            if sent:
                flash("An OTP code has been sent to your email address.", "info")
            else:
                flash(f"An OTP code has been generated. (Dev Code: {code})", "warning")
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
    saved_theme = None
    try:
        if current_user and current_user.is_authenticated:
            saved_theme = getattr(current_user, "theme", None)
    except Exception:
        pass
    if not saved_theme:
        saved_theme = request.cookies.get("theme") or session.get("theme")

    logout_user()
    session.pop("verify_user_id", None)
    session.pop("verify_purpose", None)
    flash("Logged out successfully.", "info")
    resp = redirect(url_for("auth.login", role="farmer"))
    if saved_theme in ("light", "dark", "system"):
        session["theme"] = saved_theme
        resp.set_cookie("theme", saved_theme, max_age=31536000, path="/", samesite="Lax")
    return resp


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
        _sync_client_theme_to_user(user)
        login_user(user, remember=False)

        session.pop("verify_user_id", None)
        session.pop("verify_purpose", None)

        flash("Authentication successful!", "success")
        return _redirect_with_theme(url_for("main.index"), user)

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

    sent = _send_verification_email(user.email, code)
    if sent:
        flash("A new verification code has been sent to your Gmail/Email address.", "success")
    else:
        flash(f"New verification code generated. (Dev Code: {code})", "warning")
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

        sent = _send_verification_email(user.email, code)

        session["verify_user_id"] = user.id
        session["verify_purpose"] = "login"
        if sent:
            flash("Two-step verification code has been sent to your Gmail/Email address.", "info")
        else:
            flash(f"Two-step verification code: {code} (Email delivery failed. Use this dev code to continue)", "warning")
        return redirect(url_for("auth.verify_code"))

    _sync_client_theme_to_user(user)
    login_user(user, remember=False)
    flash("Welcome back!", "success")
    return _redirect_with_theme(url_for("main.index"), user)


# ==========================================
# WEBAUTHN PASSKEYS ROUTES 🔑
# ==========================================
from app.services.passkey_service import (
    get_registration_options_json,
    verify_and_save_registration,
    get_authentication_options_json,
    verify_authentication,
)

@auth_bp.route("/passkey/register/options", methods=["GET"])
@login_required
def passkey_register_options():
    try:
        options_json, challenge_str = get_registration_options_json(current_user, request)
        session["passkey_registration_challenge"] = challenge_str
        return options_json, 200, {"Content-Type": "application/json"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/passkey/register/verify", methods=["POST"])
@login_required
def passkey_register_verify():
    payload = request.get_json()
    challenge_b64 = session.get("passkey_registration_challenge")
    if not challenge_b64:
        return {"status": "error", "message": "Passkey registration session expired or missing challenge."}, 400

    try:
        passkey = verify_and_save_registration(current_user, payload, challenge_b64, request)
        session.pop("passkey_registration_challenge", None)
        audit_log(
            "PASSKEY_REGISTER_SUCCESS",
            target_user=current_user.username,
            user_id=current_user.id,
            detail=f"Passkey '{passkey.name}' registered successfully",
        )
        return {"status": "ok", "message": "Passkey registered successfully."}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/passkey/login/options", methods=["GET"])
def passkey_login_options():
    try:
        options_json, challenge_str = get_authentication_options_json(request)
        session["passkey_login_challenge"] = challenge_str
        return options_json, 200, {"Content-Type": "application/json"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/passkey/login/verify", methods=["POST"])
def passkey_login_verify():
    payload = request.get_json()
    challenge_b64 = session.get("passkey_login_challenge")
    if not challenge_b64:
        return {"status": "error", "message": "Passkey login session expired or missing challenge."}, 400

    try:
        user, passkey = verify_authentication(payload, challenge_b64, request)
        session.pop("passkey_login_challenge", None)

        _sync_client_theme_to_user(user)
        login_user(user, remember=False)
        audit_log(
            "AUTH_PASSKEY_LOGIN_SUCCESS",
            target_user=user.username,
            user_id=user.id,
            detail=f"Passkey '{passkey.name}' authentication success",
        )
        flash("Logged in successfully via Passkey!", "success")
        redirect_url = url_for("main.index")
        resp = make_response(jsonify({"status": "ok", "redirect_url": redirect_url}))
        if user.theme in ("light", "dark", "system"):
            resp.set_cookie("theme", user.theme, max_age=31536000, path="/", samesite="Lax")
        return resp
    except Exception as e:
        return {"status": "error", "message": str(e)}, 400

@auth_bp.route("/reset-password-api", methods=["POST"])
def reset_password_api():
    data = request.get_json()
    action = text_field(data, "action", required=True, maximum=30)
    if action not in {"send_code", "verify_code", "reset_password"}:
        raise InputValidationError("action", "Unknown action.")

    if action == "send_code":
        email = email_field(data)
        user = User.query.filter_by(email=email).first()
        if user and user.is_active:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()
            sent = _send_verification_email(user.email, code)
            if sent:
                return {"success": True, "message": "OTP sent to your email"}
            return {"success": True, "message": f"OTP generated (Dev Code: {code})", "code": code}
        return {"success": True, "message": "If account exists, OTP sent"} # Prevent email enum

    elif action == "verify_code":
        email = email_field(data)
        input_code = code_field(data)
        user = User.query.filter_by(email=email).first()
        if not user or not user.two_factor_code or user.two_factor_code != input_code:
            return {"success": False, "message": "Invalid OTP code"}
        if user.two_factor_expiry and user.two_factor_expiry < datetime.datetime.utcnow():
            return {"success": False, "message": "OTP expired"}
        return {"success": True, "message": "OTP verified"}

    elif action == "reset_password":
        email = email_field(data)
        input_code = code_field(data)
        new_password = password_field(data, new=True)
        user = User.query.filter_by(email=email).first()
        if not user or not user.two_factor_code or user.two_factor_code != input_code:
            return {"success": False, "message": "Invalid OTP code"}
        
        if not user.two_factor_expiry or user.two_factor_expiry < datetime.datetime.utcnow():
            return {"success": False, "message": "OTP expired"}, 400

        user.set_password(new_password)
        user.two_factor_code = None
        user.two_factor_expiry = None
        db.session.commit()
        return {"success": True, "message": "Password reset successfully"}

    return {"success": False, "message": "Unknown action"}, 400
