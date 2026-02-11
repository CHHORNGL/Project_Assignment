# app/blueprints/expert/routes.py

from flask import (
    render_template,
    redirect,
    url_for,
    flash,
    request
)
from flask_login import current_user
from sqlalchemy import func   # ✅ needed for charts
from datetime import datetime, timedelta
import re

from app.utils.decorators import role_required
from app.extensions import db

from app.models.diagnosis import Diagnosis
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.crop import Crop
from app.models.disease import Disease
from app.models.rule import Rule
from app.models.symptom import Symptom
from app.models.user import User
from app.services.notification_service import notify_user, _snippet

from . import expert_bp


# ===============================
# EXPERT DASHBOARD
# ===============================
@expert_bp.route("/dashboard")
@role_required("expert")
def dashboard():

    # Pending diagnoses (global)
    pending_diagnoses = (
        Diagnosis.query
        .filter(Diagnosis.status.in_(["PENDING", "AUTO"]))
        .order_by(Diagnosis.created_at.desc())
        .all()
    )

    auto_cases = (
        Diagnosis.query
        .filter_by(status="AUTO")
        .order_by(Diagnosis.created_at.desc())
        .limit(6)
        .all()
    )

    # Approved by this expert
    approved_count = (
        Diagnosis.query
        .filter_by(
            status="APPROVED",
            expert_id=current_user.id
        )
        .count()
    )

    # Rejected by this expert
    rejected_count = (
        Diagnosis.query
        .filter_by(
            status="REJECTED",
            expert_id=current_user.id
        )
        .count()
    )

    # Farmer chats count
    chat_count = (
        db.session.query(ChatMessage.farmer_id)
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(ChatMessage.sender == "farmer", ChatSession.session_type == "ai")
        .distinct()
        .count()
    )

    # ===============================
    # 📊 PERFORMANCE CHART DATA
    # ===============================
    chart_rows = (
        db.session.query(
            Diagnosis.status,
            func.count(Diagnosis.id)
        )
        .filter(Diagnosis.expert_id == current_user.id)
        .group_by(Diagnosis.status)
        .all()
    )

    chart_labels = [row[0] for row in chart_rows]
    chart_values = [row[1] for row in chart_rows]

    return render_template(
        "expert/dashboard.html",
        diagnoses=pending_diagnoses,
        auto_cases=auto_cases,
        approved_count=approved_count,
        rejected_count=rejected_count,
        chat_count=chat_count,
        chart_labels=chart_labels,
        chart_values=chart_values
    )


# ===============================
# FARMER SUPPORT HUB
# ===============================
@expert_bp.route("/support")
@role_required("expert")
def support_hub():
    # Rule chat stats
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)

    total_rule_sessions = ChatSession.query.filter_by(session_type="rule").count()
    rule_unique_farmers = (
        ChatSession.query
        .filter_by(session_type="rule")
        .with_entities(ChatSession.farmer_id)
        .distinct()
        .count()
    )
    total_rule_messages = (
        ChatMessage.query
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(ChatSession.session_type == "rule")
        .count()
    )
    last_24h_rule_messages = (
        ChatMessage.query
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(ChatSession.session_type == "rule", ChatMessage.created_at >= last_24h)
        .count()
    )

    # Filters for rule-based diagnoses
    crop_id = request.args.get("crop_id", type=int)
    status = request.args.get("status", default="AUTO")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    cases_q = Diagnosis.query
    if status:
        cases_q = cases_q.filter(Diagnosis.status == status)
    if crop_id:
        cases_q = cases_q.filter(Diagnosis.crop_id == crop_id)
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            cases_q = cases_q.filter(Diagnosis.created_at >= dt_from)
        except ValueError:
            date_from = ""
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            cases_q = cases_q.filter(Diagnosis.created_at < dt_to)
        except ValueError:
            date_to = ""

    auto_cases = (
        cases_q
        .order_by(Diagnosis.created_at.desc())
        .all()
    )

    # Filters for rule-based chat sessions
    chat_date_from = request.args.get("chat_date_from")
    chat_date_to = request.args.get("chat_date_to")
    chat_keyword = request.args.get("chat_keyword", default="", type=str)
    chat_farmer_id = request.args.get("chat_farmer_id", type=int)

    chat_q = (
        ChatMessage.query
        .join(ChatSession, ChatSession.id == ChatMessage.session_id)
        .filter(ChatSession.session_type == "rule")
    )
    if chat_farmer_id:
        chat_q = chat_q.filter(ChatSession.farmer_id == chat_farmer_id)
    if chat_keyword:
        chat_q = chat_q.filter(ChatMessage.message.ilike(f"%{chat_keyword}%"))
    if chat_date_from:
        try:
            dt_from = datetime.strptime(chat_date_from, "%Y-%m-%d")
            chat_q = chat_q.filter(ChatMessage.created_at >= dt_from)
        except ValueError:
            chat_date_from = ""
    if chat_date_to:
        try:
            dt_to = datetime.strptime(chat_date_to, "%Y-%m-%d") + timedelta(days=1)
            chat_q = chat_q.filter(ChatMessage.created_at < dt_to)
        except ValueError:
            chat_date_to = ""

    rule_chat_messages = (
        chat_q
        .order_by(ChatMessage.created_at.desc())
        .limit(100)
        .all()
    )

    rule_farmers = (
        ChatSession.query
        .filter_by(session_type="rule")
        .with_entities(ChatSession.farmer_id)
        .distinct()
        .all()
    )
    rule_farmer_ids = [row[0] for row in rule_farmers]

    rule_farmers_list = (
        User.query
        .filter(User.id.in_(rule_farmer_ids))
        .order_by(User.username.asc())
        .all()
    )

    crops = Crop.query.order_by(Crop.name.asc()).all()
    return render_template(
        "expert/support_hub.html",
        auto_cases=auto_cases,
        crops=crops,
        filter_crop_id=crop_id,
        filter_status=status,
        filter_date_from=date_from,
        filter_date_to=date_to,
        total_rule_sessions=total_rule_sessions,
        rule_unique_farmers=rule_unique_farmers,
        total_rule_messages=total_rule_messages,
        last_24h_rule_messages=last_24h_rule_messages,
        rule_chat_messages=rule_chat_messages,
        rule_farmers=rule_farmers_list,
        chat_date_from=chat_date_from,
        chat_date_to=chat_date_to,
        chat_keyword=chat_keyword,
        chat_farmer_id=chat_farmer_id
    )


# ===============================
# PENDING DIAGNOSES
# ===============================
@expert_bp.route("/pending")
@role_required("expert")
def pending_diagnoses():

    pending_diagnoses = (
        Diagnosis.query
        .filter(Diagnosis.status.in_(["PENDING", "AUTO"]))
        .order_by(Diagnosis.created_at.desc())
        .all()
    )

    return render_template(
        "expert/pending_diagnoses.html",
        diagnoses=pending_diagnoses
    )


# ===============================
# REVIEW DIAGNOSIS
# ===============================
@expert_bp.route("/diagnosis/<int:diagnosis_id>", methods=["GET", "POST"])
@role_required("expert")
def review_diagnosis(diagnosis_id):

    diagnosis = Diagnosis.query.get_or_404(diagnosis_id)

    if request.method == "POST":
        action = request.form.get("action")

        if action == "approve":
            solution = request.form.get("solution")

            if not solution:
                flash("Solution is required.", "danger")
                return redirect(request.url)

            diagnosis.approve(
                expert_id=current_user.id,
                solution=solution
            )
            db.session.commit()
            try:
                notify_user(
                    user_id=diagnosis.farmer_id,
                    kind="diagnosis_approved",
                    title="Diagnosis approved",
                    subtitle=_snippet(solution),
                    url=url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
                    icon="fas fa-check-circle",
                    level="success",
                    source_id=diagnosis.id,
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
            flash("Diagnosis approved.", "success")

        elif action == "reject":
            diagnosis.reject(expert_id=current_user.id)
            db.session.commit()
            try:
                notify_user(
                    user_id=diagnosis.farmer_id,
                    kind="diagnosis_rejected",
                    title="Diagnosis rejected",
                    subtitle="Your diagnosis was rejected. Please review and resubmit.",
                    url=url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
                    icon="fas fa-times-circle",
                    level="danger",
                    source_id=diagnosis.id,
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
            flash("Diagnosis rejected.", "warning")

        return redirect(url_for("expert.dashboard"))

    return render_template(
        "expert/review_diagnosis.html",
        diagnosis=diagnosis
    )


# ===============================
# FARMER CHAT LIST
# ===============================
@expert_bp.route("/farmer-chats")
@role_required("expert")
def farmer_chats():
    sessions = (
        ChatSession.query
        .filter_by(session_type="ai")
        .order_by(ChatSession.updated_at.desc())
        .all()
    )

    return render_template(
        "expert/farmer_chats.html",
        sessions=sessions
    )


# ===============================
# CHAT WITH FARMER
# ===============================
@expert_bp.route("/chat/<int:farmer_id>")
@role_required("expert")
def reply_chat(farmer_id):
    session = (
        ChatSession.query
        .filter_by(farmer_id=farmer_id, session_type="ai")
        .order_by(ChatSession.updated_at.desc())
        .first()
    )
    if not session:
        session = ChatSession(farmer_id=farmer_id, title="New Chat", session_type="ai")
        db.session.add(session)
        db.session.commit()
    return redirect(url_for("expert.reply_chat_session", session_id=session.id))


@expert_bp.route("/chat/session/<int:session_id>", methods=["GET", "POST"])
@role_required("expert")
def reply_chat_session(session_id):
    session = ChatSession.query.filter_by(id=session_id, session_type="ai").first_or_404()

    if request.method == "POST":
        message = request.form.get("message")

        if message:
            expert_message = ChatMessage(
                sender="expert",
                message=message,
                farmer_id=session.farmer_id,
                session_id=session.id
            )
            db.session.add(expert_message)
            session.updated_at = db.func.now()
            db.session.commit()

            try:
                notify_user(
                    user_id=session.farmer_id,
                    kind="expert_message",
                    title="Expert replied",
                    subtitle=_snippet(message),
                    url=url_for("farmer.chat", session_id=session.id),
                    icon="fas fa-comment-dots",
                    level="info",
                    source_id=expert_message.id,
                )
                db.session.commit()
            except Exception:
                db.session.rollback()
        return redirect(
            url_for("expert.reply_chat_session", session_id=session.id)
        )

    messages = (
        ChatMessage.query
        .filter_by(farmer_id=session.farmer_id, session_id=session.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return render_template(
        "expert/reply_chat.html",
        messages=messages,
        session=session
    )


# ===============================
# DISEASE LIST
# ===============================
@expert_bp.route("/diseases")
@role_required("expert")
def diseases():
    diseases = Disease.query.order_by(Disease.name.asc()).all()
    return render_template(
        "expert/diseases.html",
        diseases=diseases
    )


# ===============================
# CREATE DISEASE
# ===============================
@expert_bp.route("/diseases/create", methods=["GET", "POST"])
@role_required("expert")
def create_disease():

    crops = Crop.query.order_by(Crop.name.asc()).all()

    if request.method == "POST":
        crop_id = request.form.get("crop_id")
        name = request.form.get("name")
        name_kh = request.form.get("name_kh")
        description = request.form.get("description")
        description_kh = request.form.get("description_kh")
        treatment = request.form.get("treatment")
        treatment_kh = request.form.get("treatment_kh")
        severity = request.form.get("severity_level")

        if not crop_id or not name:
            flash("Crop and disease name are required", "danger")
            return redirect(request.url)

        disease = Disease(
            crop_id=crop_id,
            name=name,
            name_kh=name_kh,
            description=description,
            description_kh=description_kh,
            treatment=treatment,
            treatment_kh=treatment_kh,
            severity_level=severity
        )

        db.session.add(disease)
        db.session.commit()

        flash("Disease added successfully", "success")
        return redirect(url_for("expert.diseases"))

    return render_template(
        "expert/create_disease.html",
        crops=crops,
        back_url=url_for("expert.diseases")
    )


# ===============================
# EDIT DISEASE
# ===============================
@expert_bp.route("/diseases/<int:disease_id>/edit", methods=["GET", "POST"])
@role_required("expert")
def edit_disease(disease_id):
    disease = Disease.query.get_or_404(disease_id)
    crops = Crop.query.order_by(Crop.name.asc()).all()

    if request.method == "POST":
        crop_id = request.form.get("crop_id")
        name = request.form.get("name")
        name_kh = request.form.get("name_kh")
        description = request.form.get("description")
        description_kh = request.form.get("description_kh")
        treatment = request.form.get("treatment")
        treatment_kh = request.form.get("treatment_kh")
        severity = request.form.get("severity_level")

        if not crop_id or not name:
            flash("Crop and disease name are required", "danger")
            return redirect(request.url)

        disease.crop_id = crop_id
        disease.name = name
        disease.name_kh = name_kh
        disease.description = description
        disease.description_kh = description_kh
        disease.treatment = treatment
        disease.treatment_kh = treatment_kh
        disease.severity_level = severity

        db.session.commit()
        flash("Disease updated", "success")
        return redirect(url_for("expert.diseases"))

    return render_template(
        "expert/create_disease.html",
        crops=crops,
        disease=disease,
        edit_mode=True,
        back_url=url_for("expert.diseases")
    )


# ===============================
# DELETE DISEASE
# ===============================
@expert_bp.route("/diseases/<int:disease_id>/delete", methods=["POST"])
@role_required("expert")
def delete_disease(disease_id):
    disease = Disease.query.get_or_404(disease_id)
    db.session.delete(disease)
    db.session.commit()
    flash("Disease deleted", "warning")
    return redirect(url_for("expert.diseases"))


# ===============================
# BULK DELETE DISEASES
# ===============================
@expert_bp.route("/diseases/bulk", methods=["POST"])
@role_required("expert")
def diseases_bulk():
    action = request.form.get("action")
    scope = request.form.get("scope", "selected")

    if action != "delete":
        flash("Select a bulk action", "danger")
        return redirect(url_for("expert.diseases"))

    if scope == "all":
        diseases = Disease.query.all()
    else:
        disease_ids = request.form.getlist("disease_ids")
        if not disease_ids:
            flash("Select at least one disease", "warning")
            return redirect(url_for("expert.diseases"))
        diseases = Disease.query.filter(Disease.id.in_(disease_ids)).all()

    if not diseases:
        flash("No diseases found to delete", "warning")
        return redirect(url_for("expert.diseases"))

    for disease in diseases:
        db.session.delete(disease)
    db.session.commit()

    flash(f"Deleted {len(diseases)} disease(s)", "warning")
    return redirect(url_for("expert.diseases"))


# ===============================
# OPTIONAL FORM
# ===============================
@expert_bp.route("/form", methods=["GET", "POST"])
@role_required("expert")
def form():

    if request.method == "POST":
        crop_name = request.form.get("crop_name", "").strip()
        disease_name = request.form.get("disease_name", "").strip()
        symptoms_text = request.form.get("symptoms", "").strip()
        solution_text = request.form.get("solution", "").strip()

        if not crop_name or not disease_name or not symptoms_text:
            flash("Please fill in crop, disease, and symptoms.", "danger")
            return redirect(request.url)

        def normalize_name(value: str) -> str:
            value = value.lower().strip()
            value = re.sub(r"[^a-z0-9\s]+", " ", value)
            value = re.sub(r"\s+", " ", value)
            return value

        crop_norm = normalize_name(crop_name)
        disease_norm = normalize_name(disease_name)

        crop = Crop.query.filter(func.lower(Crop.name) == crop_norm).first()
        if not crop:
            crop = Crop(name=crop_name)
            db.session.add(crop)
            db.session.flush()

        disease = (
            Disease.query
            .filter(Disease.crop_id == crop.id)
            .filter(func.lower(Disease.name) == disease_norm)
            .first()
        )
        if not disease:
            disease = Disease(crop_id=crop.id, name=disease_name)
            db.session.add(disease)
            db.session.flush()

        if solution_text:
            if not disease.description:
                disease.description = solution_text
            elif solution_text not in disease.description:
                disease.description = f"{disease.description}\n\nTreatment: {solution_text}"

        symptoms_list = [
            s.strip()
            for s in re.split(r"[,\n;/]+", symptoms_text)
            if s.strip()
        ]

        symptom_objs = []
        for raw in symptoms_list:
            sym_norm = normalize_name(raw)
            if not sym_norm:
                continue
            symptom = Symptom.query.filter(func.lower(Symptom.name) == sym_norm).first()
            if not symptom:
                symptom = Symptom(name=sym_norm)
                db.session.add(symptom)
            symptom_objs.append(symptom)

        rule_name = f"{disease.name} Rule"
        rule = Rule.query.filter_by(disease_id=disease.id, name=rule_name).first()
        if not rule:
            rule = Rule(name=rule_name, disease_id=disease.id, confidence=1.0)
            db.session.add(rule)

        for symptom in symptom_objs:
            if symptom not in rule.symptoms:
                rule.symptoms.append(symptom)

        db.session.commit()

        flash("Knowledge saved to rule base.", "success")
        return redirect(url_for("expert.knowledge_dashboard"))

    return render_template("expert/form.html")
