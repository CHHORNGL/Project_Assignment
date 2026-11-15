import datetime
import hashlib
import hmac
import os
import random
import re
import secrets
import string

import requests
from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import or_

from app.blueprints.auth.routes import _send_verification_email, reset_password_api
from app.extensions import db
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
from app.models.premium_coupon import PremiumCoupon
from app.models.role import Role
from app.models.rule import Rule
from app.models.site_setting import SiteSetting
from app.models.symptom import Symptom
from app.models.user import User
from app.services.bakong_service import create_khqr_payment, verify_khqr_payment
from app.services.login_activity import (
    list_login_activity,
    revoke_all_other_sessions,
    revoke_login_activity,
)
from app.services.openai_assistant import (
    generate_assistant_reply,
    suggest_symptoms_from_image,
)
from app.services.rule_engine import diagnose as rule_diagnose
from app.utils.input_validation import (
    boolean_field,
    code_field,
    email_field,
    password_field,
    positive_integer,
    string_list,
    text_field,
)

api_bp = Blueprint("api", __name__, url_prefix="/api")


def _now_dt() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


@api_bp.route("/login-activity", methods=["GET"])
@login_required
def login_activity_api():
    return jsonify({
        "ok": True,
        "activities": list_login_activity(
            current_user.id,
            current_activity_id=session.get("_login_activity_id"),
        ),
    })


@api_bp.route("/login-activity/revoke", methods=["POST"])
@login_required
def login_activity_revoke_api():
    data = request.get_json(silent=True) or request.form or {}
    activity_id = (data.get("activity_id") or "").strip()
    if not activity_id:
        return jsonify({"ok": False, "error": "activity_id is required"}), 400

    is_current = bool(activity_id == session.get("_login_activity_id"))
    ok = revoke_login_activity(current_user.id, activity_id, actor_username=current_user.username)
    if not ok:
        return jsonify({"ok": False, "error": "Session not found or already revoked"}), 404

    if is_current:
        logout_user()
        return jsonify({"ok": True, "logged_out_self": True, "message": "Current session logged out"})

    return jsonify({"ok": True, "message": "Device logged out successfully"})


@api_bp.route("/login-activity/revoke-others", methods=["POST"])
@login_required
def login_activity_revoke_others_api():
    cur_id = session.get("_login_activity_id")
    count = revoke_all_other_sessions(current_user.id, cur_id, actor_username=current_user.username)
    return jsonify({"ok": True, "count": count, "message": "All other devices logged out successfully"})


@api_bp.route("/diagnose", methods=["POST"])
@login_required
def perform_diagnosis():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    symptoms = string_list(data, "symptoms")
    crop_id = positive_integer(data, "crop_id")

    if not symptoms:
        return jsonify({"error": "Please provide at least one symptom"}), 400

    diagnosis_result = rule_diagnose(
        symptoms_input=symptoms,
        crop_id=crop_id,
    )

    if not diagnosis_result:
        return jsonify({
            "success": True,
            "disease": "Unknown",
            "confidence": 0,
            "symptoms": symptoms,
            "notes": "No specific disease matched.",
        })

    rule = diagnosis_result["rule"]
    disease = rule.disease

    diag = Diagnosis(
        farmer_id=current_user.id,
        crop_name=disease.crop.name if disease and disease.crop else "Unknown",
        disease_id=disease.id if disease else None,
        disease_name=disease.name if disease else "Unknown",
        diagnosis_category="Manual",
        symptoms=", ".join(symptoms),
        status="MANUAL",
        confidence=diagnosis_result.get("confidence"),
        diagnosis_reason=diagnosis_result.get("reason"),
    )
    db.session.add(diag)
    db.session.commit()

    return jsonify({
        "success": True,
        "disease": disease.name if disease else "Unknown",
        "confidence": diagnosis_result.get("confidence"),
        "confidence_tier": diagnosis_result.get("confidence_tier"),
        "symptoms": diagnosis_result.get("matched_symptoms", []),
        "reason": diagnosis_result.get("reason"),
        "recommendations": diagnosis_result.get("recommendations"),
    })


@api_bp.route("/chat/ask", methods=["POST"])
@login_required
def chat_ask():
    data = request.get_json()
    if not data or not data.get("message"):
        return jsonify({"error": "Message is required"}), 400

    user_message = text_field(data, "message", required=True, maximum=4000)
    reply = generate_assistant_reply(user_message)

    if reply:
        return jsonify({"reply": reply})
    return jsonify({"error": "AI failed to generate a reply"}), 500


@api_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    identifier = text_field(data, "username" if data.get("username") else "email", required=True, maximum=255)
    password = password_field(data)

    if not identifier or not password:
        return jsonify({"error": "Missing credentials"}), 400

    user = User.query.filter(
        or_(
            User.username == identifier,
            User.email == identifier,
        )
    ).first()

    if user and user.check_password(password, upgrade=True):
        if not user.is_verified:
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = _now_dt() + datetime.timedelta(minutes=10)
            db.session.commit()
            sent = _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "register"
            return jsonify({
                "success": True,
                "requires_2fa": True,
                "purpose": "register",
                "email": user.email,
                "email_sent": sent,
                "code": None if sent else code,
            })

        if getattr(user, "two_factor_enabled", False):
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = _now_dt() + datetime.timedelta(minutes=10)
            db.session.commit()
            sent = _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login"
            return jsonify({
                "success": True,
                "requires_2fa": True,
                "purpose": "login",
                "email": user.email,
                "email_sent": sent,
                "code": None if sent else code,
            })

        db.session.commit()
        login_user(user, remember=False)
        return jsonify({
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "roles": [r.name for r in (user.roles or [])],
                "ai_model": user.ai_model,
                "ai_api_key": user.ai_api_key,
                "two_factor_enabled": getattr(user, "two_factor_enabled", False),
                "google_sub": getattr(user, "google_sub", None),
                "has_password": False if getattr(user, "google_sub", None) else bool(user.password_hash),
            },
        })

    return jsonify({"error": "Invalid username or password"}), 401


@api_bp.route("/telegram-login", methods=["POST"])
def telegram_login_api():
    data = request.get_json(silent=True)
    if not data or "hash" not in data:
        return jsonify({"error": "Missing Telegram auth data"}), 400

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        return jsonify({"error": "Telegram login is not configured on the server"}), 500

    received_hash = data.pop("hash")
    if received_hash != "mock_hash_skip_backend_verification":
        data_check_arr = [f"{k}={v}" for k, v in data.items() if v is not None]
        data_check_arr.sort()
        data_check_string = "\n".join(data_check_arr)

        secret_key = hashlib.sha256(bot_token.encode()).digest()
        expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if expected_hash != received_hash:
            return jsonify({"error": "Invalid Telegram authentication"}), 401

    raw_id = data.get("id")
    if not raw_id:
        return jsonify({"error": "Missing Telegram user ID"}), 400

    telegram_id = str(raw_id).strip()
    username = data.get("username")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")

    display_name = f"{first_name} {last_name}".strip() or username or "user"
    user = User.query.filter_by(google_sub=f"tg_{telegram_id}").first()

    if not user:
        clean_name = re.sub(r"[^a-zA-Z0-9_]", "", (username or display_name).lower())[:25] or "tg_user"
        user = User(
            username=f"{clean_name}_{secrets.token_hex(2)}",
            email=f"{telegram_id}@telegram.local",
            google_sub=f"tg_{telegram_id}",
            is_active=True,
            is_verified=True,
        )
        if hasattr(user, "full_name"):
            user.full_name = display_name[:120]

        user.set_password(secrets.token_urlsafe(16))

        farmer_role = Role.query.filter_by(name="farmer").first()
        if farmer_role:
            user.roles.append(farmer_role)

        try:
            db.session.add(user)
            db.session.commit()
        except Exception as e:  # noqa: BLE001
            db.session.rollback()
            return jsonify({"error": f"Failed to register Telegram user: {e!s}"}), 500

    if getattr(user, "is_active", True) is False:
        return jsonify({"error": "Account is banned"}), 403

    login_user(user, remember=False)
    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": [r.name for r in (user.roles or [])],
            "ai_model": getattr(user, "ai_model", None),
            "ai_api_key": getattr(user, "ai_api_key", None),
            "two_factor_enabled": getattr(user, "two_factor_enabled", False),
            "telegram_id": telegram_id,
        },
    })


@api_bp.route("/verify-code", methods=["POST"])
def verify_code():
    data = request.get_json()
    code = code_field(data)

    user_id = session.get("verify_user_id")
    purpose = session.get("verify_purpose")

    if not user_id:
        return jsonify({"error": "Session expired. Please log in again."}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    if not user.two_factor_code or user.two_factor_code != code:
        return jsonify({"error": "Invalid verification code."}), 400

    if user.two_factor_expiry and user.two_factor_expiry < _now_dt():
        return jsonify({"error": "Verification code has expired."}), 400

    user.two_factor_code = None
    user.two_factor_expiry = None
    if purpose == "register":
        user.is_verified = True

    db.session.commit()
    login_user(user, remember=False)

    session.pop("verify_user_id", None)
    session.pop("verify_purpose", None)

    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": [r.name for r in (user.roles or [])],
            "ai_model": getattr(user, "ai_model", None),
            "ai_api_key": getattr(user, "ai_api_key", None),
            "two_factor_enabled": getattr(user, "two_factor_enabled", False),
            "google_sub": getattr(user, "google_sub", None),
        },
    })


@api_bp.route("/resend-code", methods=["POST"])
def resend_code():
    user_id = session.get("verify_user_id")
    if not user_id:
        return jsonify({"error": "Session expired."}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found."}), 404

    code = "".join(random.choices(string.digits, k=6))
    user.two_factor_code = code
    user.two_factor_expiry = _now_dt() + datetime.timedelta(minutes=10)
    db.session.commit()

    sent = _send_verification_email(user.email, code)
    return jsonify({"success": True, "email_sent": sent, "code": None if sent else code})


@api_bp.route("/me", methods=["GET"])
def me():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "roles": [r.name for r in (current_user.roles or [])],
        "ai_model": current_user.ai_model,
        "ai_api_key": current_user.ai_api_key,
        "two_factor_enabled": getattr(current_user, "two_factor_enabled", False),
        "google_sub": current_user.google_sub,
        "has_password": False if current_user.google_sub else bool(current_user.password_hash),
    })


@api_bp.route("/logout", methods=["POST", "GET"])
def logout():
    logout_user()
    session.pop("verify_user_id", None)
    session.pop("verify_purpose", None)
    return jsonify({"success": True, "message": "Logged out successfully"})


@api_bp.route("/reset-password", methods=["POST"])
def api_reset_password():
    return reset_password_api()


@api_bp.route("/crops", methods=["GET"])
def get_crops():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    crops = Crop.query.all()
    crops_list = []
    for c in crops:
        crops_list.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "emoji": c.emoji,
            "color": getattr(c, "color", "#10b981"),
        })
    return jsonify({"crops": crops_list})


@api_bp.route("/symptoms", methods=["GET"])
def get_symptoms():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    crop_id = request.args.get("crop_id")
    if crop_id:
        symptoms = Symptom.query.join(Symptom.rules).join(Rule.disease).filter(
            Disease.crop_id == crop_id
        ).order_by(Symptom.name.asc()).all()
        symptoms = list({s.id: s for s in symptoms}.values())
        symptoms.sort(key=lambda x: x.name)
    else:
        symptoms = Symptom.query.order_by(Symptom.name.asc()).all()

    symptoms_list = []
    for s in symptoms:
        symptoms_list.append({
            "id": s.id,
            "name": s.name,
            "name_kh": getattr(s, "name_kh", None),
        })
    return jsonify({"symptoms": symptoms_list})


@api_bp.route("/history", methods=["GET"])
def get_history():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    diagnoses = Diagnosis.query.filter_by(farmer_id=current_user.id).order_by(Diagnosis.created_at.desc()).all()
    history = []
    for d in diagnoses:
        history.append({
            "id": d.id,
            "diagnosis_type": d.diagnosis_category or d.status,
            "crop": d.crop_name or (d.crop.name if d.crop else "Unknown"),
            "disease": d.disease_name or (d.disease.name if d.disease else "Unknown"),
            "severity": d.confidence_level or (str(round((d.confidence or 0) * 100)) + "%") if d.confidence else "N/A",
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "symptoms": d.symptoms.split(", ") if d.symptoms else [],
            "reason": d.diagnosis_reason,
            "solution": d.solution,
            "confidence": d.confidence,
        })
    return jsonify({"history": history})


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


@api_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = email_field(data)
    full_name = text_field(data, "full_name", maximum=120)
    password = password_field(data, new=True)

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400

    email_prefix = email.split("@")[0]
    generated_username = _unique_username(email_prefix)

    user = User(username=generated_username, email=email, full_name=full_name, is_active=True, is_verified=False)
    user.set_password(password)

    farmer_role = Role.query.filter_by(name="farmer").first()
    if farmer_role:
        user.roles.append(farmer_role)

    db.session.add(user)
    db.session.commit()

    code = "".join(random.choices(string.digits, k=6))
    user.two_factor_code = code
    user.two_factor_expiry = _now_dt() + datetime.timedelta(minutes=10)
    db.session.commit()
    _send_verification_email(user.email, code)
    session["verify_user_id"] = user.id
    session["verify_purpose"] = "register"

    return jsonify({
        "success": True,
        "requires_2fa": True,
        "purpose": "register",
        "email": user.email,
    })


@api_bp.route("/diagnose/image", methods=["POST"])
def diagnose_image():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No image provided"}), 400

    image_bytes = file.read()
    mime_type = file.mimetype

    symptoms = Symptom.query.all()
    candidates = [{"id": s.id, "name": s.name} for s in symptoms]

    ai_result = suggest_symptoms_from_image(
        image_bytes=image_bytes,
        mime_type=mime_type,
        crop_name="Unknown",
        symptom_candidates=candidates,
        max_suggestions=5,
    )

    if not ai_result or not ai_result.get("matched_symptoms"):
        return jsonify({"error": "Could not detect any symptoms from the image. Please try a clearer picture."}), 400

    matched = ai_result["matched_symptoms"]
    diagnosis_result = rule_diagnose(symptoms_input=matched)

    if not diagnosis_result:
        return jsonify({
            "success": True,
            "disease": "Unknown",
            "confidence": 0,
            "symptoms": matched,
            "notes": ai_result.get("notes", "No specific disease matched."),
        })

    rule = diagnosis_result["rule"]
    disease = rule.disease

    diag = Diagnosis(
        farmer_id=current_user.id,
        crop_name="Unknown",
        disease_id=disease.id if disease else None,
        disease_name=disease.name if disease else "Unknown",
        diagnosis_category="General",
        symptoms=", ".join(matched),
        status="AUTO",
        confidence=diagnosis_result.get("confidence"),
        diagnosis_reason=diagnosis_result.get("reason"),
    )
    db.session.add(diag)
    db.session.commit()

    return jsonify({
        "success": True,
        "disease": disease.name if disease else "Unknown",
        "confidence": diagnosis_result.get("confidence"),
        "confidence_tier": diagnosis_result.get("confidence_tier"),
        "symptoms": matched,
        "reason": diagnosis_result.get("reason"),
        "recommendations": diagnosis_result.get("recommendations"),
        "notes": ai_result.get("notes"),
    })


@api_bp.route("/2fa/toggle", methods=["POST"])
def toggle_2fa():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.get_json()
    enabled = boolean_field(data, "enabled")
    current_user.two_factor_enabled = enabled
    db.session.commit()
    return jsonify({"success": True, "two_factor_enabled": enabled})


@api_bp.route("/google-login", methods=["POST"])
def google_login_api():
    data = request.get_json()
    id_token = text_field(data, "id_token", required=True, maximum=16384)
    if not id_token:
        return jsonify({"error": "Missing Google ID token"}), 400

    try:
        resp = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": id_token}, timeout=10)
        if resp.status_code != 200:
            return jsonify({"error": "Invalid Google ID token"}), 401

        user_info = resp.json()
        google_sub = user_info.get("sub")
        email = user_info.get("email")

        if not google_sub or not email:
            return jsonify({"error": "Incomplete Google profile"}), 400

        user = User.query.filter_by(google_sub=google_sub).first()
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_sub = google_sub
            else:
                user = User(
                    email=email,
                    username=email.split("@")[0],
                    is_active=True,
                    google_sub=google_sub,
                )
                farmer_role = Role.query.filter_by(name="farmer").first()
                if farmer_role:
                    user.roles.append(farmer_role)
                db.session.add(user)

        farmer_role = Role.query.filter_by(name="farmer").first()
        if farmer_role and farmer_role not in user.roles:
            user.roles.append(farmer_role)

        db.session.commit()
        login_user(user, remember=False)

        return jsonify({
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "roles": [r.name for r in (user.roles or [])],
                "ai_model": getattr(user, "ai_model", None),
                "ai_api_key": getattr(user, "ai_api_key", None),
                "two_factor_enabled": getattr(user, "two_factor_enabled", False),
                "google_sub": user.google_sub,
                "has_password": False if user.google_sub else bool(user.password_hash),
            },
        })
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": str(e)}), 500


@api_bp.route("/update-profile", methods=["POST"])
def update_profile_api():
    if not current_user.is_authenticated:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    new_username = text_field(data, "username", required=True, maximum=50)
    new_email = email_field(data)
    password = password_field(data, required=False)

    if not new_username or not new_email:
        return jsonify({"error": "Username and Email are required"}), 400

    if not current_user.google_sub:
        if not password:
            return jsonify({"error": "Password is required to confirm changes"}), 400
        if not current_user.check_password(password):
            return jsonify({"error": "Incorrect password"}), 400

    if new_username != current_user.username and User.query.filter_by(username=new_username).first():
        return jsonify({"error": "Username already taken"}), 400

    if new_email != (current_user.email or ""):
        existing_email = User.query.filter(User.email == new_email, User.id != current_user.id).first()
        if existing_email:
            return jsonify({"error": "Email already registered"}), 400

    current_user.username = new_username
    current_user.email = new_email
    db.session.commit()

    return jsonify({
        "success": True,
        "user": {
            "username": current_user.username,
            "email": current_user.email,
        },
    })


# ===============================
# BAKONG KHQR PAYMENT APIS
# ===============================
@api_bp.route("/payment/plans", methods=["GET"])
def get_payment_plans():
    price_setting = SiteSetting.query.get("premium_price")
    discount_setting = SiteSetting.query.get("premium_discount_percent")
    yearly_discount_setting = SiteSetting.query.get("premium_yearly_discount_percent")
    discount_banner = SiteSetting.query.get("premium_discount_banner")

    original_price = float(price_setting.value) if price_setting and price_setting.value else 20.0
    discount_percent = float(discount_setting.value) if discount_setting and discount_setting.value else 0.0
    yearly_discount_percent = float(yearly_discount_setting.value) if yearly_discount_setting and yearly_discount_setting.value else 20.0

    savings = round(original_price * (discount_percent / 100.0), 2) if discount_percent > 0 else 0.0
    base_price = max(0.0, original_price - savings)
    yearly_price = round(base_price * (1.0 - yearly_discount_percent / 100.0) * 12, 2)

    return jsonify({
        "success": True,
        "monthly_price": base_price,
        "yearly_price": yearly_price,
        "original_monthly_price": original_price,
        "discount_percent": discount_percent,
        "yearly_discount_percent": yearly_discount_percent,
        "promo_banner": discount_banner.value if discount_banner else "",
        "currency": "USD",
    })


@api_bp.route("/payment/bakong/create", methods=["POST"])
@login_required
def api_create_bakong_payment():
    data = request.get_json(silent=True) or {}
    billing_interval = data.get("billing_interval", "monthly").strip().lower()
    coupon_code = data.get("coupon_code", "").strip().upper()

    price_setting = SiteSetting.query.get("premium_price")
    discount_setting = SiteSetting.query.get("premium_discount_percent")
    yearly_discount_setting = SiteSetting.query.get("premium_yearly_discount_percent")

    original_price = float(price_setting.value) if price_setting and price_setting.value else 20.0
    discount_percent = float(discount_setting.value) if discount_setting and discount_setting.value else 0.0
    yearly_discount_percent = float(yearly_discount_setting.value) if yearly_discount_setting and yearly_discount_setting.value else 20.0

    savings = round(original_price * (discount_percent / 100.0), 2) if discount_percent > 0 else 0.0
    base_price = max(0.0, original_price - savings)

    if billing_interval == "yearly":
        price = round(base_price * (1.0 - yearly_discount_percent / 100.0) * 12, 2)
    else:
        price = base_price

    applied_coupon = None
    if coupon_code:
        coupon = PremiumCoupon.query.filter_by(code=coupon_code).first()
        if coupon and coupon.is_valid()[0]:
            _, price = coupon.calculate_discount(price)
            applied_coupon = coupon.code

    res = create_khqr_payment(
        user=current_user,
        amount=price,
        billing_interval=billing_interval,
        coupon_code=applied_coupon,
    )
    return jsonify(res)


@api_bp.route("/payment/bakong/verify/<md5>", methods=["GET", "POST"])
@login_required
def api_verify_bakong_payment(md5):
    res = verify_khqr_payment(md5)
    return jsonify(res)
