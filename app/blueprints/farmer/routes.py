# app/blueprints/farmer/routes.py

from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    flash,
    request,
    current_app
)
import re
import os
from uuid import uuid4
from flask_login import current_user
from sqlalchemy.orm import joinedload
from werkzeug.utils import secure_filename

from app.utils.decorators import farmer_required
from app.extensions import db

from app.models.crop import Crop
from app.models.disease import Disease
from app.models.diagnosis import Diagnosis
from app.models.rule import Rule
from app.models.symptom import Symptom
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.services.rule_engine import diagnose as rule_diagnose
from app.services.openai_assistant import generate_assistant_reply
from app.services.notification_service import notify_role, _snippet
from app.utils.i18n import t, get_current_language


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    text = text.strip().lower()
    text = re.sub(r"[^\w\s]+", " ", text, flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _localize_field(obj, field: str, fallback: str = "") -> str:
    if obj is None:
        return fallback
    if get_current_language() == "km":
        value = getattr(obj, f"{field}_kh", None)
        if value:
            return value
    value = getattr(obj, field, None)
    return value if value else fallback
from app.utils.i18n import get_current_language


# ===============================
# FARMER BLUEPRINT
# ===============================
farmer_bp = Blueprint(
    "farmer",
    __name__,
    url_prefix="/farmer"
)


# ===============================
# FARMER DASHBOARD
# ===============================
@farmer_bp.route("/dashboard")
@farmer_required
def dashboard():
    """
    Show diagnoses submitted by this farmer only
    """

    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id)
        .order_by(Diagnosis.created_at.desc())
        .all()
    )

    ai_questions = (
        db.session.query(ChatMessage, ChatSession)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(
            ChatSession.farmer_id == current_user.id,
            ChatSession.session_type == "ai",
            ChatMessage.sender == "farmer"
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
        .all()
    )

    return render_template(
        "farmer/dashboard.html",
        diagnoses=diagnoses,
        ai_questions=ai_questions
    )


# ===============================
# FARMER CHAT HISTORY (VIEW ALL)
# ===============================
@farmer_bp.route("/history/ai")
@farmer_required
def ai_history():
    questions = (
        db.session.query(ChatMessage, ChatSession)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(
            ChatSession.farmer_id == current_user.id,
            ChatSession.session_type == "ai",
            ChatMessage.sender == "farmer"
        )
        .order_by(ChatMessage.created_at.desc())
        .all()
    )
    return render_template(
        "farmer/ai_history.html",
        questions=questions
    )

# ===============================
# FARMER RULE-BASED INFERENCE HISTORY
# ===============================
@farmer_bp.route("/history/rule-inference")
@farmer_required
def rule_inference_history():
    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id, status="AUTO")
        .order_by(Diagnosis.created_at.desc())
        .all()
    )
    return render_template(
        "farmer/rule_inference_history.html",
        diagnoses=diagnoses
    )


# ===============================
# FARMER ALL DIAGNOSES HISTORY
# ===============================
@farmer_bp.route("/diagnoses/history")
@farmer_required
def diagnosis_history():
    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id)
        .order_by(Diagnosis.created_at.desc())
        .all()
    )
    return render_template(
        "farmer/diagnosis_history.html",
        diagnoses=diagnoses
    )


# ===============================
# FARMER AUTO DIAGNOSIS (STEP 11+)
# ===============================
def _process_diagnose_post():
    if request.method != "POST":
        return None

    crop_id = request.form.get("crop_id")
    symptoms_text = request.form.get("symptoms")
    if not crop_id or not symptoms_text:
        flash("??? Please select crop and enter symptoms", "danger")
        return redirect(request.url)

    crop = Crop.query.get(crop_id)
    if not crop:
        flash("??? Invalid crop selected", "danger")
        return redirect(request.url)

    # ---------------------------------
    # RULE ENGINE
    # ---------------------------------
    symptoms_list = [
        s.strip().lower()
        for s in symptoms_text.split(",")
        if s.strip()
    ]

    result = rule_diagnose(symptoms_list, crop_id=crop.id)

    if result:
        rule = result["rule"]
        matched_symptoms = result["matched_symptoms"]

        disease_name = rule.disease.name if rule.disease else "Unknown"
        confidence = result.get("confidence")
        disease_id = rule.disease.id if rule.disease else None
    else:
        disease_name = "Unknown"
        confidence = None
        matched_symptoms = []
        disease_id = None

    diagnosis = Diagnosis(
        farmer_id=current_user.id,
        crop_id=crop.id,
        crop_name=crop.name,
        disease_id=disease_id,
        disease_name=disease_name,
        symptoms=symptoms_text,
        status="AUTO",
        confidence=confidence
    )

    db.session.add(diagnosis)
    db.session.commit()

    try:
        subtitle = _snippet(f"{crop.name}: {symptoms_text}")
        notify_role(
            role_name="admin",
            kind="diagnosis_created",
            title="New diagnosis submitted",
            subtitle=subtitle,
            url=url_for("admin.dashboard"),
            icon="fas fa-seedling",
            level="info",
            source_id=diagnosis.id,
        )
        notify_role(
            role_name="expert",
            kind="diagnosis_created",
            title="New diagnosis to review",
            subtitle=subtitle,
            url=url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
            icon="fas fa-notes-medical",
            level="warning",
            source_id=diagnosis.id,
        )
        db.session.commit()
    except Exception:
        db.session.rollback()

    flash("??? Diagnosis completed successfully", "success")

    return redirect(
        url_for(
            "farmer.diagnosis_result",
            diagnosis_id=diagnosis.id
        )
    )


@farmer_bp.route("/diagnose", methods=["GET", "POST"])
@farmer_required
def diagnose():
    """
    Farmer submits crop + symptoms
    System uses Rule Engine to auto-diagnose
    """

    result = _process_diagnose_post()
    if result:
        return result

    crops = Crop.query.order_by(Crop.name.asc()).all()

    # Sidebar: recent diagnoses
    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(10)
        .all()
    )

    return render_template(
        "farmer/diagnose.html",
        crops=crops,
        diagnoses=diagnoses
    )


@farmer_bp.route("/diagnose/rule-based", methods=["GET", "POST"])
@farmer_required
def diagnose_rule_based():
    """
    Farmer submits crop + symptoms (fully rule-based inference form)
    """

    if request.method == "POST":
        crop_id = request.form.get("crop_id")
        symptom_ids = request.form.getlist("symptoms")

        if not crop_id:
            flash("Please select a crop.", "danger")
            return redirect(request.url)

        if not symptom_ids:
            flash("Please select at least one symptom.", "danger")
            return redirect(request.url)

        crop = Crop.query.get(crop_id)
        if not crop:
            flash("Invalid crop selected.", "danger")
            return redirect(request.url)

        symptoms = (
            Symptom.query
            .filter(Symptom.id.in_(symptom_ids))
            .order_by(Symptom.name.asc())
            .all()
        )
        symptoms_text = ", ".join([s.name for s in symptoms])
        symptoms_list = [s.name for s in symptoms]

        result = rule_diagnose(symptoms_list, crop_id=crop.id)

        if result:
            rule = result["rule"]
            disease_name = rule.disease.name if rule.disease else "Unknown"
            confidence = result.get("confidence")
            disease_id = rule.disease.id if rule.disease else None
        else:
            disease_name = "Unknown"
            confidence = None
            disease_id = None

        diagnosis = Diagnosis(
            farmer_id=current_user.id,
            crop_id=crop.id,
            crop_name=crop.name,
            disease_id=disease_id,
            disease_name=disease_name,
            symptoms=symptoms_text,
            status="AUTO",
            confidence=confidence
        )

        db.session.add(diagnosis)
        db.session.commit()

        try:
            subtitle = _snippet(f"{crop.name}: {symptoms_text}")
            notify_role(
                role_name="admin",
                kind="diagnosis_created",
                title="New diagnosis submitted",
                subtitle=subtitle,
                url=url_for("admin.dashboard"),
                icon="fas fa-seedling",
                level="info",
                source_id=diagnosis.id,
            )
            notify_role(
                role_name="expert",
                kind="diagnosis_created",
                title="New diagnosis to review",
                subtitle=subtitle,
                url=url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
                icon="fas fa-notes-medical",
                level="warning",
                source_id=diagnosis.id,
            )
            db.session.commit()
        except Exception:
            db.session.rollback()

        flash("Diagnosis completed successfully.", "success")

        return redirect(
            url_for(
                "farmer.diagnosis_result",
                diagnosis_id=diagnosis.id
            )
        )

    crops = Crop.query.order_by(Crop.name.asc()).all()

    # Sidebar: recent diagnoses
    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(10)
        .all()
    )

    # Build guided data per crop
    current_lang = get_current_language()
    rules = (
        Rule.query
        .options(joinedload(Rule.symptoms), joinedload(Rule.disease))
        .all()
    )

    symptoms_by_crop = {}
    rules_by_crop = {}

    for rule in rules:
        if not rule.disease or not rule.disease.crop_id:
            continue
        crop_id = rule.disease.crop_id

        rule_symptom_ids = []
        for s in rule.symptoms:
            if not s or not s.id or not s.name:
                continue
            rule_symptom_ids.append(s.id)
            symptoms_by_crop.setdefault(crop_id, {})
            display_name = s.name_kh if current_lang == "km" and getattr(s, "name_kh", None) else s.name
            symptoms_by_crop[crop_id][s.id] = display_name

        if rule_symptom_ids:
            rules_by_crop.setdefault(crop_id, [])
            rules_by_crop[crop_id].append(rule_symptom_ids)

    symptoms_by_crop_list = {}
    for cid, symptom_map in symptoms_by_crop.items():
        items = [{"id": sid, "name": name} for sid, name in symptom_map.items()]
        items.sort(key=lambda x: x["name"].lower())
        symptoms_by_crop_list[cid] = items

    return render_template(
        "farmer/diagnose_rule_based.html",
        crops=crops,
        diagnoses=diagnoses,
        symptoms_by_crop=symptoms_by_crop_list,
        rules_by_crop=rules_by_crop
    )

# ===============================
# DIAGNOSIS RESULT
# ===============================
@farmer_bp.route("/result/<int:diagnosis_id>")
@farmer_required
def diagnosis_result(diagnosis_id):
    """
    Show diagnosis result (owner only)
    """

    diagnosis = Diagnosis.query.get_or_404(diagnosis_id)

    # Security: owner only
    if diagnosis.farmer_id != current_user.id:
        flash("Access denied.", "danger")
        return redirect(url_for("farmer.dashboard"))

    # Sidebar: recent diagnoses
    diagnoses = (
        Diagnosis.query
        .filter_by(farmer_id=current_user.id)
        .order_by(Diagnosis.created_at.desc())
        .limit(10)
        .all()
    )

    possible_diseases = []
    if diagnosis.crop_id:
        possible_diseases = (
            Disease.query
            .filter_by(crop_id=diagnosis.crop_id)
            .order_by(Disease.name.asc())
            .all()
        )

    return render_template(
        "farmer/result.html",
        diagnosis=diagnosis,
        diagnoses=diagnoses,
        possible_diseases=possible_diseases
    )


# ===============================
# FARMER CHAT (ChatGPT STYLE)
# ===============================
def _ensure_legacy_session(farmer_id: int):
    legacy_messages = (
        ChatMessage.query
        .filter_by(farmer_id=farmer_id, session_id=None)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    if not legacy_messages:
        return None

    session = ChatSession(farmer_id=farmer_id, title="Legacy Chat", session_type="ai")
    db.session.add(session)
    db.session.flush()

    for message in legacy_messages:
        message.session_id = session.id

    db.session.commit()
    return session


@farmer_bp.route("/chat/new")
@farmer_required
def new_chat():
    session = ChatSession(farmer_id=current_user.id, title="New Chat", session_type="ai")
    db.session.add(session)
    db.session.commit()
    return redirect(url_for("farmer.chat", session_id=session.id))


@farmer_bp.route("/chat", methods=["GET", "POST"])
@farmer_bp.route("/chat/<int:session_id>", methods=["GET", "POST"])
@farmer_required
def chat(session_id=None):
    """
    Farmer chat page (ChatGPT-style UI)
    """

    # Ensure legacy messages belong to a session
    _ensure_legacy_session(current_user.id)

    sessions = (
        ChatSession.query
        .filter_by(farmer_id=current_user.id, session_type="ai")
        .order_by(ChatSession.updated_at.desc())
        .all()
    )

    if session_id is None:
        if sessions:
            return redirect(url_for("farmer.chat", session_id=sessions[0].id))
        return redirect(url_for("farmer.new_chat"))

    session = (
        ChatSession.query
        .filter_by(id=session_id, farmer_id=current_user.id, session_type="ai")
        .first_or_404()
    )

    # ---------------------------------
    # POST → Save message
    # ---------------------------------
    if request.method == "POST":
        user_message = request.form.get("message", "").strip()

        if user_message:
            farmer_message = ChatMessage(
                sender="farmer",
                message=user_message,
                farmer_id=current_user.id,
                session_id=session.id
            )
            db.session.add(farmer_message)

            # Try to answer using expert rule base
            message_lower = user_message.lower()
            message_norm = _normalize_text(user_message)
            crops = Crop.query.order_by(Crop.name.asc()).all()

            def is_greeting(text: str) -> bool:
                if get_current_language() == "km":
                    greetings = ["ជំរាបសួរ", "សួស្តី", "សួរស្តី", "សួស្ដី", "សួរស្ដី"]
                    return any(g in text for g in greetings)
                tokens = re.findall(r"[a-z]+", text.lower())
                if not tokens:
                    return False
                greeting_words = {
                    "hi", "hello", "hey", "hii", "hola", "salaam", "goodmorning", "goodafternoon", "goodevening"
                }
                short = len(tokens) <= 3
                return short and any(t in greeting_words for t in tokens)

            def is_crop_info_request(text: str) -> bool:
                keywords = ["about", "info", "information", "know", "disease", "problem", "issue", "help"]
                return any(k in text for k in keywords)

            def find_crop():
                if not crops:
                    return None
                # Prefer explicit crop: pattern
                crop_match = re.search(r"crop\s*[:\-]\s*([a-z0-9\s]+)", message_lower)
                if crop_match:
                    crop_text = crop_match.group(1).strip()
                    for crop in sorted(crops, key=lambda c: len(c.name), reverse=True):
                        if crop.name and crop.name.lower() in crop_text:
                            return crop
                        if crop.name_kh and crop.name_kh in crop_text:
                            return crop
                # Otherwise match crop name as whole word in the message
                for crop in sorted(crops, key=lambda c: len(c.name), reverse=True):
                    candidates = [crop.name, crop.name_kh]
                    for candidate in candidates:
                        if not candidate:
                            continue
                        pattern = r"\b" + re.escape(_normalize_text(candidate)) + r"\b"
                        if re.search(pattern, message_norm):
                            return crop
                return None

            def extract_symptoms(text):
                match = re.search(r"(symptoms?|signs?)\s*[:\-]\s*(.+)", text, re.I)
                explicit = False
                if match:
                    text = match.group(2)
                    explicit = True
                text = re.sub(r"\band\b|និង", ",", text, flags=re.I)
                tokens = [
                    t.strip().lower()
                    for t in re.split(r"[,\n;/]+", text)
                    if t.strip()
                ]
                # Filter out very short tokens to avoid false matches like "hi"
                tokens = [t for t in tokens if len(t) >= 3]
                return tokens, explicit

            crop = find_crop()
            symptoms_list, explicit_symptoms = extract_symptoms(user_message)

            reply = generate_assistant_reply(user_message)

            if not reply:
                if is_greeting(message_lower):
                    reply = t("chat_greeting")
                elif crop and (not symptoms_list or (not explicit_symptoms and len(symptoms_list) <= 1)):
                    diseases = (
                        Disease.query
                        .filter_by(crop_id=crop.id)
                        .order_by(Disease.name.asc())
                        .all()
                    )
                    if diseases:
                        names = ", ".join([_localize_field(d, "name", d.name) for d in diseases[:6]])
                        more = "..." if len(diseases) > 6 else ""
                        reply = t(
                            "chat_crop_diseases",
                            crop=_localize_field(crop, "name", crop.name),
                            count=len(diseases),
                            names=f"{names}{more}"
                        )
                    else:
                        reply = t(
                            "chat_no_diseases_for_crop",
                            crop=_localize_field(crop, "name", crop.name)
                        )
                elif crop and symptoms_list and (explicit_symptoms or len(symptoms_list) >= 2):
                    result = rule_diagnose(symptoms_list, crop_id=crop.id)
                    if result:
                        rule = result["rule"]
                        matched = result.get("matched_symptoms", [])
                        disease = rule.disease
                        disease_name = _localize_field(disease, "name", "Unknown")
                        confidence = result.get("confidence")
                        conf_text = f"{int(round(confidence * 100))}%" if confidence is not None else "N/A"
                        description = _localize_field(disease, "description", t("no_description"))
                        reply = t(
                            "chat_rule_based_result",
                            crop=_localize_field(crop, "name", crop.name),
                            disease=disease_name,
                            confidence=conf_text,
                            matched=", ".join(matched) if matched else t("not_available"),
                            description=description
                        )
                    else:
                        reply = t("chat_no_rule_match")
                else:
                    reply = t("chat_need_crop_and_symptoms")

            db.session.add(
                ChatMessage(
                    sender="system",
                    message=reply,
                    farmer_id=current_user.id,
                    session_id=session.id
                )
            )

            if not session.title or session.title == "New Chat":
                session.title = (user_message[:40] + "...") if len(user_message) > 40 else user_message
            session.updated_at = db.func.now()
            db.session.commit()

            try:
                notify_role(
                    role_name="expert",
                    kind="farmer_message",
                    title="New farmer message",
                    subtitle=_snippet(user_message),
                    url=url_for("expert.reply_chat_session", session_id=session.id),
                    icon="fas fa-comment-dots",
                    level="info",
                    source_id=farmer_message.id,
                )
                db.session.commit()
            except Exception:
                db.session.rollback()

        return redirect(url_for("farmer.chat", session_id=session.id))

    # ---------------------------------
    # GET → Load messages
    # ---------------------------------
    messages = (
        ChatMessage.query
        .filter_by(farmer_id=current_user.id, session_id=session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return render_template(
        "farmer/chat.html",
        messages=messages,
        sessions=sessions,
        active_session=session
    )
