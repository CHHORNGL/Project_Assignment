# app/blueprints/farmer/routes.py

from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    flash,
    request,
    jsonify,
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
from app.services.openai_assistant import generate_assistant_reply, suggest_symptoms_from_image
from app.services.notification_service import notify_role, _snippet
from app.utils.i18n import t, get_current_language, normalize_display_text


DIAGNOSIS_CATEGORIES = [
    {"id": "fungal", "label": "Fungal disease"},
    {"id": "bacterial", "label": "Bacterial disease"},
    {"id": "viral", "label": "Viral disease"},
    {"id": "pest", "label": "Pest / insect"},
    {"id": "nutrient", "label": "Nutrient deficiency"},
    {"id": "environment", "label": "Environment / water stress"},
    {"id": "other", "label": "Not sure"},
]

AGRI_QCM_DOMAINS = [
    {
        "id": "crop",
        "label": "Crop Production",
        "label_kh": "ដំណាំ",
        "subcategories": [
            {"id": "rice", "label": "Rice", "label_kh": "ស្រូវ"},
            {"id": "vegetable", "label": "Vegetables", "label_kh": "បន្លែ"},
            {"id": "fruit_tree", "label": "Fruit Trees", "label_kh": "ផ្លែឈើ"},
            {"id": "maize", "label": "Maize / Corn", "label_kh": "ពោត"},
            {"id": "root_tuber", "label": "Root & Tuber", "label_kh": "ដំណាំមើម"},
            {"id": "legume", "label": "Legume / Pulse", "label_kh": "សណ្តែក"},
            {"id": "spice", "label": "Spice Crops", "label_kh": "គ្រឿងទេស"},
            {"id": "oilseed", "label": "Oilseed Crops", "label_kh": "ដំណាំប្រេង"},
        ],
    },
]

AGRI_QCM_DOMAINS = [
    {
        "id": "crop",
        "label": "Crop Production",
        "label_kh": "ការផលិតដំណាំ",
        "subcategories": [
            {"id": "rice", "label": "Rice", "label_kh": "អង្ករ"},
            {"id": "vegetable", "label": "Vegetables", "label_kh": "បន្លែ"},
            {"id": "fruit_tree", "label": "Fruit Trees", "label_kh": "ផ្លែឈើ"},
            {"id": "maize", "label": "Maize / Corn", "label_kh": "សាលពង្រ"},
            {"id": "root_tuber", "label": "Root & Tuber", "label_kh": "ឫស និងកំណាច"},
            {"id": "legume", "label": "Legume / Pulse", "label_kh": "ដំណាំសណ្ដែក"},
            {"id": "spice", "label": "Spice Crops", "label_kh": "គ្រឿង"},
            {"id": "oilseed", "label": "Oilseed Crops", "label_kh": "ដំណាំគ្រាប់មុខ"},
        ],
    },
]

DOMAIN_DEFAULT_DIAGNOSIS_CATEGORY = {"crop": "other"}

CROP_SUBCATEGORY_EXACT = {
    "rice": "rice",
    "paddy": "rice",
    "corn": "maize",
    "maize": "maize",
    "potato": "root_tuber",
    "cassava": "root_tuber",
    "soybean": "legume",
    "soy bean": "legume",
    "sesame": "oilseed",
    "banana": "fruit_tree",
    "tomato": "vegetable",
    "cucumber": "vegetable",
    "chili pepper": "spice",
    "chilli pepper": "spice",
    "pepper": "spice",
}

CROP_SUBCATEGORY_KEYWORDS = [
    ("rice", ["rice", "paddy"]),
    ("maize", ["corn", "maize"]),
    ("root_tuber", ["cassava", "potato", "sweet potato", "tuber", "root"]),
    ("legume", ["soybean", "soy bean", "bean", "pea", "pulse"]),
    ("oilseed", ["sesame", "sunflower", "canola", "oilseed"]),
    ("spice", ["chili", "chilli", "pepper", "ginger", "turmeric", "spice"]),
    ("fruit_tree", ["banana", "mango", "papaya", "citrus", "fruit"]),
    ("vegetable", ["cucumber", "tomato", "eggplant", "cabbage", "onion", "carrot", "vegetable"]),
]


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


def _infer_crop_subcategory(crop: Crop) -> str:
    if not crop:
        return ""

    names = []
    for raw in [getattr(crop, "name", None), getattr(crop, "name_kh", None)]:
        normalized = _normalize_text(str(raw or ""))
        if normalized:
            names.append(normalized)

    for normalized_name in names:
        exact_match = CROP_SUBCATEGORY_EXACT.get(normalized_name)
        if exact_match:
            return exact_match

    for normalized_name in names:
        for subcategory_id, keywords in CROP_SUBCATEGORY_KEYWORDS:
            if any(keyword in normalized_name for keyword in keywords):
                return subcategory_id

    return ""


def _agri_domains_payload() -> list[dict]:
    lang = get_current_language()
    payload: list[dict] = []
    for domain in AGRI_QCM_DOMAINS:
        payload.append(
            {
                "id": domain.get("id"),
                "label": normalize_display_text(domain.get("label", ""), lang=lang),
                "label_kh": normalize_display_text(
                    domain.get("label_kh") or domain.get("label", ""),
                    lang=lang,
                ),
                "subcategories": [
                    {
                        "id": sub.get("id"),
                        "label": normalize_display_text(sub.get("label", ""), lang=lang),
                        "label_kh": normalize_display_text(
                            sub.get("label_kh") or sub.get("label", ""), lang=lang
                        ),
                    }
                    for sub in (domain.get("subcategories") or [])
                ],
            }
        )
    return payload


def _safe_int_list(raw_values) -> list[int]:
    values: list[int] = []
    seen = set()
    for raw in raw_values or []:
        try:
            value = int(raw)
        except (TypeError, ValueError):
            continue
        if value <= 0 or value in seen:
            continue
        seen.add(value)
        values.append(value)
    return values


def _symptom_candidates_for_crop(crop_id: int) -> list[dict]:
    candidates: dict[int, dict] = {}

    rules = (
        Rule.query
        .options(joinedload(Rule.symptoms), joinedload(Rule.disease))
        .join(Rule.disease)
        .filter(Disease.crop_id == crop_id)
        .all()
    )
    for rule in rules:
        for symptom in rule.symptoms or []:
            if not symptom or not symptom.id or not symptom.name:
                continue
            if symptom.id in candidates:
                continue
            candidates[symptom.id] = {
                "id": symptom.id,
                "name": symptom.name,
                "name_kh": getattr(symptom, "name_kh", None),
            }

    if not candidates:
        all_symptoms = Symptom.query.order_by(Symptom.name.asc()).all()
        for symptom in all_symptoms:
            if not symptom or not symptom.id or not symptom.name:
                continue
            candidates[symptom.id] = {
                "id": symptom.id,
                "name": symptom.name,
                "name_kh": getattr(symptom, "name_kh", None),
            }

    return sorted(candidates.values(), key=lambda item: str(item.get("name") or "").lower())


def _split_csv_symptoms(raw_text: str | None) -> list[str]:
    if not raw_text:
        return []
    rows: list[str] = []
    seen = set()
    for raw in str(raw_text).split(","):
        cleaned = str(raw).strip()
        key = _normalize_text(cleaned)
        if not cleaned or not key or key in seen:
            continue
        seen.add(key)
        rows.append(cleaned)
    return rows


def _build_symptom_breakdown(diagnosis: Diagnosis, limit: int = 5) -> list[dict]:
    evidence = diagnosis.diagnosis_evidence if isinstance(diagnosis.diagnosis_evidence, dict) else {}

    raw_scores = evidence.get("symptom_scores")
    normalized: list[dict] = []
    if isinstance(raw_scores, list):
        for row in raw_scores:
            if not isinstance(row, dict):
                continue
            name = str(row.get("name") or "").strip()
            try:
                percent = float(row.get("percent") or 0.0)
            except (TypeError, ValueError):
                percent = 0.0
            if not name or percent <= 0:
                continue
            normalized.append({"name": name, "percent": round(max(0.0, min(100.0, percent)), 1)})
        if normalized and len(normalized) >= max(1, min(4, limit)):
            normalized.sort(key=lambda item: item["percent"], reverse=True)
            return normalized[:max(1, limit)]

    ranked_candidates = evidence.get("ranked_candidates")
    if isinstance(ranked_candidates, list):
        score_by_symptom = {}
        for candidate in ranked_candidates:
            if not isinstance(candidate, dict):
                continue
            try:
                candidate_confidence = float(candidate.get("confidence") or 0.0)
            except (TypeError, ValueError):
                candidate_confidence = 0.0
            matched = candidate.get("matched_symptoms")
            if candidate_confidence <= 0 or not isinstance(matched, list):
                continue

            unique_matched = []
            seen_local = set()
            for raw_symptom in matched:
                symptom_name = str(raw_symptom or "").strip()
                symptom_key = _normalize_text(symptom_name)
                if not symptom_name or not symptom_key or symptom_key in seen_local:
                    continue
                seen_local.add(symptom_key)
                unique_matched.append((symptom_key, symptom_name))

            if not unique_matched:
                continue

            per_symptom_weight = candidate_confidence / float(len(unique_matched))
            for symptom_key, symptom_name in unique_matched:
                bucket = score_by_symptom.setdefault(
                    symptom_key,
                    {"name": symptom_name, "score": 0.0},
                )
                bucket["score"] += per_symptom_weight

        if score_by_symptom:
            max_score = max(float(row["score"]) for row in score_by_symptom.values()) or 1.0
            rows = []
            for row in score_by_symptom.values():
                rows.append(
                    {
                        "name": row["name"],
                        "percent": round((float(row["score"]) / max_score) * 100.0, 1),
                    }
                )
            rows.sort(key=lambda item: item["percent"], reverse=True)
            if normalized:
                existing_keys = {_normalize_text(row["name"]) for row in rows}
                for row in normalized:
                    key = _normalize_text(row["name"])
                    if key and key not in existing_keys:
                        rows.append({"name": row["name"], "percent": row["percent"]})
            rows.sort(key=lambda item: item["percent"], reverse=True)
            return rows[:max(1, limit)]

    fallback_symptoms = _split_csv_symptoms(getattr(diagnosis, "symptoms", None))[:max(1, limit)]
    if not fallback_symptoms:
        return []
    share = round(100.0 / float(len(fallback_symptoms)), 1)
    return [{"name": row, "percent": share} for row in fallback_symptoms]
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
    crops = Crop.query.order_by(Crop.name.asc()).all()

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
        ai_questions=ai_questions,
        crops=crops
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
        flash(t("please_select_symptom"), "danger")
        return redirect(request.url)

    crop = Crop.query.get(crop_id)
    if not crop:
        flash(t("invalid_crop_selected"), "danger")
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
        crop_name=_localize_field(crop, "name", crop.name),
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

    flash(t("diagnosis_completed"), "success")

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


@farmer_bp.route("/scan-crop", methods=["GET"])
@farmer_required
def scan_crop():
    crop_id = (request.args.get("crop_id") or "").strip()
    instant = "1" if (request.args.get("instant") or "").strip() == "1" else "0"
    return redirect(url_for("farmer.diagnose_rule_based", scan="1", instant=instant, crop_id=crop_id))


@farmer_bp.route("/api/scan/symptom-suggestions", methods=["POST"])
@farmer_required
def scan_symptom_suggestions_api():
    crop_id_raw = (request.form.get("crop_id") or "").strip()
    try:
        crop_id = int(crop_id_raw)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": t("please_select_crop")}), 400

    crop = Crop.query.get(crop_id)
    if not crop:
        return jsonify({"ok": False, "error": t("invalid_crop_selected")}), 404

    upload = request.files.get("field_image")
    if not upload or not upload.filename:
        return jsonify({"ok": False, "error": t("scan_image_required")}), 400

    mimetype = (upload.mimetype or "").strip().lower()
    if not mimetype.startswith("image/"):
        return jsonify({"ok": False, "error": t("invalid_image_type")}), 400

    image_bytes = upload.read() or b""
    if not image_bytes:
        return jsonify({"ok": False, "error": t("scan_image_required")}), 400
    if len(image_bytes) > 5 * 1024 * 1024:
        return jsonify({"ok": False, "error": t("max_upload_size")}), 413

    symptom_candidates = _symptom_candidates_for_crop(crop_id)
    if not symptom_candidates:
        return jsonify(
            {
                "ok": True,
                "suggestions": [],
                "analysis": "",
                "confidence": None,
            }
        )

    result = suggest_symptoms_from_image(
        image_bytes=image_bytes,
        mime_type=mimetype,
        crop_name=_localize_field(crop, "name", crop.name),
        symptom_candidates=symptom_candidates,
        max_suggestions=8,
    )
    if result is None:
        return jsonify({"ok": False, "error": t("scan_api_unavailable")}), 503

    current_lang = get_current_language()
    suggestions = []
    for row in result.get("matched_symptoms") or []:
        if not isinstance(row, dict):
            continue
        symptom_id = row.get("id")
        if not symptom_id:
            continue
        display_name = (
            row.get("name_kh")
            if current_lang == "km" and row.get("name_kh")
            else row.get("name")
        )
        suggestions.append(
            {
                "id": symptom_id,
                "name": normalize_display_text(str(display_name or row.get("name") or ""), lang=current_lang),
            }
        )

    return jsonify(
        {
            "ok": True,
            "suggestions": suggestions,
            "analysis": str(result.get("notes") or "").strip(),
            "confidence": result.get("confidence"),
        }
    )


@farmer_bp.route("/diagnose/rule-based", methods=["GET", "POST"])
@farmer_required
def diagnose_rule_based():
    """
    Farmer submits crop + symptoms (fully rule-based inference form)
    """
    scan_mode = request.args.get("scan", "").strip() == "1"
    instant_scan_mode = request.args.get("instant", "").strip() == "1"
    initial_crop_id = request.args.get("crop_id", "").strip() or ""

    if request.method == "POST":
        scan_mode = request.form.get("scan_mode", "0") == "1"
        instant_scan_mode = request.form.get("instant_scan_mode", "0") == "1"
        crop_id = (request.form.get("crop_id") or "").strip()
        diagnosis_category = (request.form.get("diagnosis_category") or "other").strip().lower() or "other"
        symptom_ids = _safe_int_list(request.form.getlist("symptoms"))

        if not crop_id:
            flash(t("please_select_crop"), "danger")
            return redirect(request.url)

        if not symptom_ids:
            flash(t("please_select_symptom"), "danger")
            return redirect(request.url)

        crop = Crop.query.get(crop_id)
        if not crop:
            flash(t("invalid_crop_selected"), "danger")
            return redirect(request.url)

        denied_symptom_ids = _safe_int_list(request.form.getlist("denied_symptoms"))
        all_symptom_ids = symptom_ids + [sid for sid in denied_symptom_ids if sid not in symptom_ids]
        symptoms = (
            Symptom.query
            .filter(Symptom.id.in_(all_symptom_ids))
            .order_by(Symptom.name.asc())
            .all()
        )
        symptom_lookup = {symptom.id: symptom for symptom in symptoms}

        confirmed_symptoms = [symptom_lookup[sid] for sid in symptom_ids if sid in symptom_lookup]
        denied_symptoms = [symptom_lookup[sid] for sid in denied_symptom_ids if sid in symptom_lookup]
        if not confirmed_symptoms:
            flash(t("invalid_symptom_selection"), "danger")
            return redirect(request.url)

        symptoms_text = ", ".join([s.name for s in confirmed_symptoms])
        symptoms_list = [s.name for s in confirmed_symptoms]
        denied_symptom_names = [s.name for s in denied_symptoms]

        result = rule_diagnose(
            symptoms_list,
            crop_id=crop.id,
            negative_symptoms_input=denied_symptom_names,
            category=diagnosis_category,
        )

        if result:
            rule = result["rule"]
            disease_name = rule.disease.name if rule.disease else "Unknown"
            confidence = result.get("confidence")
            confidence_level = result.get("confidence_tier")
            disease_id = rule.disease.id if rule.disease else None
            diagnosis_reason = result.get("reason")
            diagnosis_evidence = result.get("evidence")
            recommendations = result.get("recommendations") or {}
            solution_text = recommendations.get("solution") or (rule.disease.treatment if rule.disease else None)
            prevention_lines = recommendations.get("prevention") or []
            prevention_text = "\n".join(f"- {line}" for line in prevention_lines)
        else:
            disease_name = "Unknown"
            confidence = None
            confidence_level = "insufficient"
            disease_id = None
            diagnosis_reason = (
                "No strong rule match was found from the confirmed symptoms. "
                "Collect more symptom evidence or request expert review."
            )
            diagnosis_evidence = {}
            solution_text = "Request expert confirmation before applying major treatment."
            prevention_text = (
                "- Monitor crop condition daily.\n"
                "- Isolate heavily affected plants when possible.\n"
                "- Keep tools and field surfaces clean."
            )

        diagnosis = Diagnosis(
            farmer_id=current_user.id,
            crop_id=crop.id,
            crop_name=_localize_field(crop, "name", crop.name),
            disease_id=disease_id,
            disease_name=disease_name,
            diagnosis_category=diagnosis_category,
            symptoms=symptoms_text,
            selected_symptom_ids=symptom_ids,
            denied_symptom_ids=denied_symptom_ids,
            status="AUTO",
            confidence=confidence,
            confidence_level=confidence_level,
            diagnosis_reason=diagnosis_reason,
            diagnosis_evidence=diagnosis_evidence,
            solution=solution_text,
            prevention_recommendations=prevention_text
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

        flash(t("diagnosis_completed"), "success")
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

    rules = (
        Rule.query
        .options(joinedload(Rule.symptoms), joinedload(Rule.disease))
        .all()
    )

    current_lang = get_current_language()
    crop_profiles = {}
    rules_by_crop = {}
    symptoms_by_crop = {0: {}}

    all_symptoms = Symptom.query.order_by(Symptom.name.asc()).all()
    for symptom in all_symptoms:
        raw_display_name = (
            symptom.name_kh
            if current_lang == "km" and getattr(symptom, "name_kh", None)
            else symptom.name
        )
        display_name = normalize_display_text(raw_display_name, lang=current_lang)
        if symptom.id and display_name:
            symptoms_by_crop[0][symptom.id] = display_name

    for crop in crops:
        inferred_subcategory_id = _infer_crop_subcategory(crop)
        crop_profiles[crop.id] = {
            "id": crop.id,
            "name": _localize_field(crop, "name", crop.name),
            "domain_id": "crop",
            "subcategory_id": inferred_subcategory_id,
        }

    for rule in rules:
        if not rule.disease or not rule.disease.crop_id:
            continue

        crop_id = rule.disease.crop_id
        rule_symptom_ids = []
        for symptom in rule.symptoms:
            if not symptom or not symptom.id or not symptom.name:
                continue
            rule_symptom_ids.append(symptom.id)
            display_name = (
                symptom.name_kh
                if current_lang == "km" and getattr(symptom, "name_kh", None)
                else symptom.name
            )
            symptoms_by_crop.setdefault(crop_id, {})
            symptoms_by_crop[crop_id][symptom.id] = normalize_display_text(display_name, lang=current_lang)

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
        all_symptoms_list=symptoms_by_crop_list.get(0, []),
        rules_by_crop=rules_by_crop,
        crop_profiles=crop_profiles,
        agri_domains=_agri_domains_payload(),
        diagnosis_categories=DIAGNOSIS_CATEGORIES,
        scan_mode=scan_mode,
        instant_scan_mode=instant_scan_mode,
        initial_crop_id=initial_crop_id,
        domain_default_diagnosis_category=DOMAIN_DEFAULT_DIAGNOSIS_CATEGORY,
        clarification_limits={},
        decision_tree_limits={},
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

    symptom_breakdown = _build_symptom_breakdown(diagnosis, limit=5)

    return render_template(
        "farmer/result.html",
        diagnosis=diagnosis,
        diagnoses=diagnoses,
        possible_diseases=possible_diseases,
        symptom_breakdown=symptom_breakdown,
    )


@farmer_bp.route("/result/<int:diagnosis_id>/feedback", methods=["POST"])
@farmer_required
def diagnosis_feedback(diagnosis_id):
    diagnosis = Diagnosis.query.get_or_404(diagnosis_id)

    if diagnosis.farmer_id != current_user.id:
        flash("Access denied.", "danger")
        return redirect(url_for("farmer.dashboard"))

    rating = (request.form.get("rating") or "").strip().lower()
    if rating not in {"helpful", "not_helpful"}:
        flash("Please select a valid feedback rating.", "danger")
        return redirect(url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id))

    comment = (request.form.get("comment") or "").strip()
    if len(comment) > 1000:
        comment = comment[:1000]

    diagnosis.submit_feedback(rating=rating, comment=comment or None)
    db.session.commit()

    flash("Thank you for your feedback.", "success")
    return redirect(url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id))


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
