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
from flask_login import current_user, login_required
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
from app.models.notification import Notification
from app.services.rule_engine import diagnose as rule_diagnose
from app.services.openai_assistant import generate_assistant_reply, suggest_symptoms_from_image
from app.services.notification_service import notify_role, notify_user, _snippet, serialize_notification
from app.services.audit_service import log_action
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

# ---------------------------------------------------------------------------
# PROJECT TEAM (rendered by /farmer/detail)
#
# TODO: replace the placeholder values below with the real data.
#   - "task"       : what the person contributed to the project
#   - "student_id" : university ID          (placeholder: 20xx-xxxx)
#   - "department" : faculty / department   (placeholder: Faculty / Department)
#   - "phone"      : phone number          (placeholder: +855 00 000 000)
#   - "telegram"   : Telegram handle       (placeholder: @username)
# Leave any field as "" (empty string) to hide that row on the card.
# ---------------------------------------------------------------------------
PROJECT_SUPERVISOR = {
    "name": "Sek Socheat",
    "name_kh": "សេក&nbsp;សុជាតិ",
    "rank": "Professor",
    "rank_kh": "សាស្ត្រាចារ្យ",
    "photo": "Sek Socheat.jpeg",
    "task": "Project Supervisor & Academic Advisor",
    "task_kh": "អ្នកគ្រប់គ្រងគម្រោង និងទីប្រឹក្សាសិក្សា",
    "student_id": "",
    "department": "Faculty / Software Development",
    "department_kh": "មហាវិទ្យាល័យ / អភិវឌ្ឍន៍កម្មវិធី",
    "email": "Socheat.sek@gmail.com",
    "phone": "+855 17 879 967",
    "telegram": "",
}

PROJECT_TEAM = [
    {
        "name": "Mao Seavik",
        "name_kh": "ម៉ៅ&nbsp;សៀវអ៊ិ",
        "rank": "Team Leader & Backend Lead",
        "rank_kh": "ប្រធានក្រុម / Backend Lead",
        "photo": "Mao Seavik.jpg",
        "task": "System Architecture, Flask Backend APIs, Rule-Based Diagnosis Engine & Weather Intelligence",
        "task_kh": "ស្ថាបត្យកម្មប្រព័ន្ធ, ការអភិវឌ្ឍ Flask Backend, ប្រព័ន្ធវិភាគរោគវិនិច្ឆ័យផ្អែកលើវិធាន និងសេវាព័ត៌មានអាកាសធាតុ",
        "student_id": "20241706",
        "department": "Student / Software Development",
        "department_kh": "និស្សិត / អភិវឌ្ឍន៍កម្មវិធី",
        "email": "Ahzarky@gmail.com",
        "phone": "+855 16 214 262",
        "telegram": "@Error404_ik",
    },
    {
        "name": "Chea Cheavchorng",
        "name_kh": "ជា&nbsp;ជៀវឈ័ង្ស",
        "rank": "Frontend & UI/UX Lead",
        "rank_kh": "អ្នកដឹកនាំ Frontend & UI/UX",
        "photo": "Chea Cheavchorng.jpeg",
        "task": "Farmer Web Dashboard, React Diagnosis Wizard, Theme Management & Responsive UI Design",
        "task_kh": "ផ្ទាំងគ្រប់គ្រងកសិករ, កម្មវិធី React Wizard សម្រាប់វិភាគជំងឺ, ការគ្រប់គ្រង Theme និងការរចនា UI",
        "student_id": "B20241176",
        "department": "Student / Software Development",
        "department_kh": "និស្សិត / អភិវឌ្ឍន៍កម្មវិធី",
        "email": "cheacheavchhorng@gmail.com",
        "phone": "+855 96 866 8000",
        "telegram": "@CHRNGL1",
    },
    {
        "name": "Nov Panha",
        "name_kh": "នូវ&nbsp;បញ្ញា",
        "rank": "Mobile App Developer",
        "rank_kh": "អ្នកអភិវឌ្ឍន៍ Mobile App",
        "photo": "Nov Panha.png",
        "task": "Flutter Cross-Platform Mobile App, Mobile API Integration & Offline Caching",
        "task_kh": "ការអភិវឌ្ឍកម្មវិធីទូរស័ព្ទ Flutter, ការតភ្ជាប់ API និងការរក្សាទុកទិន្នន័យក្រៅបណ្ដាញ",
        "student_id": "B20243413",
        "department": "Student / Software Development",
        "department_kh": "និស្សិត / អភិវឌ្ឍន៍កម្មវិធី",
        "email": "novpanha66@gmail.com",
        "phone": "+855 71 347 4377",
        "telegram": "@panha2509",
    },
    {
        "name": "Pich Rachana",
        "name_kh": "ពេជ្រ&nbsp;រចនា",
        "rank": "Data & QA Specialist",
        "rank_kh": "អ្នកគ្រប់គ្រងទិន្នន័យ & QA",
        "photo": "Pich Rachana.jpeg",
        "task": "Crop Disease & Symptom Rule Dataset Curation, Khmer Translation Matrix & System Testing",
        "task_kh": "ការស្រាវជ្រាវនិងរៀបចំទិន្នន័យជំងឺដំណាំ និងរោគសញ្ញា, ការបកប្រែភាសាខ្មែរ និងការធ្វើតេស្តប្រព័ន្ធ",
        "student_id": "B20241559",
        "department": "Student / Software Development",
        "department_kh": "និស្សិត / អភិវឌ្ឍន៍កម្មវិធី",
        "email": "pichrachana2003@gmail.com",
        "phone": "+855 10 606 032",
        "telegram": "@wirtzDisone",
    },
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


def _strip_khmer(text: str) -> str:
    """Remove Khmer Unicode characters from a string (used to clean English-only fields)."""
    if not text:
        return ""
    cleaned = re.sub(r"[\u1780-\u17ff\u19e0-\u19ff]+", "", text)
    return re.sub(r"\s+", " ", cleaned).strip()


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

    symptom_lookup = {}
    if get_current_language() == "km":
        symptoms_db = Symptom.query.all()
        symptom_lookup = {s.name.lower().strip(): s.name_kh for s in symptoms_db if s.name and s.name_kh}

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
            name_lower = name.lower().strip()
            display_name = symptom_lookup.get(name_lower, name) if get_current_language() == "km" else name
            normalized.append({"name": display_name, "percent": round(max(0.0, min(100.0, percent)), 1)})
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
                symptom_name_lower = symptom_name.lower().strip()
                display_name = symptom_lookup.get(symptom_name_lower, symptom_name) if get_current_language() == "km" else symptom_name
                bucket = score_by_symptom.setdefault(
                    symptom_key,
                    {"name": display_name, "score": 0.0},
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
    res = []
    for row in fallback_symptoms:
        row_lower = row.lower().strip()
        display_name = symptom_lookup.get(row_lower, row) if get_current_language() == "km" else row
        res.append({"name": display_name, "percent": share})
    return res
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
def dashboard():
    """
    Show diagnoses submitted by this farmer only, allow guests to view dashboard
    """
    if current_user.is_authenticated:
        if not (current_user.has_role("farmer") or any(getattr(r, 'route_type', None) == "farmer" for r in current_user.roles)):
            from flask import abort
            abort(403)
        farmer_id = current_user.id
    else:
        farmer_id = None

    crops = Crop.query.order_by(Crop.name.asc()).all()

    if farmer_id:
        diagnoses = (
            Diagnosis.query
            .filter_by(farmer_id=farmer_id)
            .order_by(Diagnosis.created_at.desc())
            .all()
        )

        ai_questions = (
            db.session.query(ChatMessage, ChatSession)
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .filter(
                ChatSession.farmer_id == farmer_id,
                ChatSession.session_type == "ai",
                ChatMessage.sender == "farmer"
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(6)
            .all()
        )
    else:
        diagnoses = []
        ai_questions = []

    from app.models.marquee import Marquee
    active_marquees = Marquee.query.filter_by(is_active=True).order_by(Marquee.sort_order).all()

    return render_template(
        "farmer/dashboard.html",
        diagnoses=diagnoses,
        ai_questions=ai_questions,
        crops=crops,
        marquees=active_marquees
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

    # ---------------------------------
    # IMAGE UPLOAD
    # ---------------------------------
    image_paths = []
    if "diagnosis_image" in request.files:
        files = request.files.getlist("diagnosis_image")
        import os, uuid
        from werkzeug.utils import secure_filename
        from flask import current_app
        
        for file in files:
            if file and file.filename != "":
                ext = os.path.splitext(file.filename)[1].lower()
                if ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
                    filename = f"diag_{uuid.uuid4().hex}{ext}"
                    upload_dir = os.path.join(current_app.root_path, "static", "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    file.save(os.path.join(upload_dir, filename))
                    image_paths.append(f"uploads/{filename}")

    if not current_user.is_authenticated:
        from flask import session
        count = session.get("guest_diagnosis_count", 0)
        if count >= 3:
            flash("You have reached the limit of 3 free diagnoses. Please register an account to continue.", "warning")
            return redirect(url_for("auth.login"))
        session["guest_diagnosis_count"] = count + 1

    diagnosis = Diagnosis(
        farmer_id=current_user.id if current_user.is_authenticated else None,
        crop_id=crop.id,
        crop_name=_localize_field(crop, "name", crop.name),
        disease_id=disease_id,
        disease_name=disease_name,
        symptoms=symptoms_text,
        status="AUTO",
        confidence=confidence,
        image_paths=image_paths if image_paths else None
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
        notify_user(
            user_id=current_user.id,
            kind="diagnosis_submitted",
            title="Diagnosis submitted",
            subtitle=f"{crop.name}: Symptoms submitted and queued for review.",
            url=url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
            icon="fas fa-clipboard-check",
            level="success",
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
def diagnose():
    """
    Farmer submits crop + symptoms
    System uses Rule Engine to auto-diagnose
    """
    if not current_user.is_authenticated:
        from flask import session
        if session.get("guest_diagnosis_count", 0) >= 3:
            flash("You have reached the limit of 3 free diagnoses. Please register an account to continue.", "warning")
            return redirect(url_for("auth.login"))

    # Redirect removed to use the cleaner, native native Diagnose UI instead of React wizard
    if request.method == "GET":
        pass
    result = _process_diagnose_post()
    if result:
        return result

    crop_id_raw = request.args.get("crop_id")
    try:
        selected_crop_id = int(crop_id_raw) if crop_id_raw else None
    except (TypeError, ValueError):
        selected_crop_id = None

    crops = Crop.query.order_by(Crop.name.asc()).all()
    crop_symptoms = {c.id: _symptom_candidates_for_crop(c.id) for c in crops}

    # Sidebar: recent diagnoses
    if current_user.is_authenticated:
        diagnoses = (
            Diagnosis.query
            .filter_by(farmer_id=current_user.id)
            .order_by(Diagnosis.created_at.desc())
            .limit(10)
            .all()
        )
    else:
        diagnoses = []

    return render_template(
        "farmer/diagnose.html",
        crops=crops,
        crop_symptoms=crop_symptoms,
        diagnoses=diagnoses,
        selected_crop_id=selected_crop_id
    )






@farmer_bp.route("/api/diagnose/live-evaluation", methods=["POST"])
def api_diagnose_live_evaluation():
    data = request.get_json() or {}
    crop_id_raw = data.get("crop_id")
    symptoms = data.get("symptoms", [])
    denied_symptoms = data.get("denied_symptoms", [])
    category = data.get("category", "")

    try:
        crop_id = int(crop_id_raw) if crop_id_raw else None
    except (TypeError, ValueError):
        crop_id = None

    pos_ids = _safe_int_list(symptoms)
    neg_ids = _safe_int_list(denied_symptoms)

    all_ids = pos_ids + [sid for sid in neg_ids if sid not in pos_ids]
    symptom_names_map = {}
    if all_ids:
        symptom_rows = Symptom.query.filter(Symptom.id.in_(all_ids)).all()
        symptom_names_map = {s.id: s.name for s in symptom_rows}

    pos_names = [symptom_names_map[sid] for sid in pos_ids if sid in symptom_names_map]
    neg_names = [symptom_names_map[sid] for sid in neg_ids if sid in symptom_names_map]

    result = rule_diagnose(
        pos_names,
        crop_id=crop_id,
        negative_symptoms_input=neg_names,
        category=category,
    )

    if result:
        candidates = result.get("ranked_candidates") or []
        return jsonify({
            "ok": True,
            "suspects": candidates,
            "best": {
                "disease_name": result.get("disease_name") or result.get("diagnosis"),
                "confidence_percent": result.get("confidence_percent"),
                "confidence_tier": result.get("confidence_tier")
            }
        })
    else:
        return jsonify({
            "ok": True,
            "suspects": [],
            "best": None
        })


@farmer_bp.route("/diagnose/rule-based", methods=["GET", "POST"])
def diagnose_rule_based():
    """
    Farmer submits crop + symptoms (fully rule-based inference form)
    """
    if not current_user.is_authenticated:
        from flask import session
        if session.get("guest_diagnosis_count", 0) >= 3:
            flash("You have reached the limit of 3 free diagnoses. Please register an account to continue.", "warning")
            return redirect(url_for("auth.login"))

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

        # ---------------------------------
        # IMAGE UPLOAD
        # ---------------------------------
        image_paths = []
        if "diagnosis_image" in request.files:
            files = request.files.getlist("diagnosis_image")
            import os, uuid
            from werkzeug.utils import secure_filename
            from flask import current_app
            
            for file in files:
                if file and file.filename != "":
                    ext = os.path.splitext(file.filename)[1].lower()
                    if ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
                        filename = f"diag_{uuid.uuid4().hex}{ext}"
                        upload_dir = os.path.join(current_app.root_path, "static", "uploads")
                        os.makedirs(upload_dir, exist_ok=True)
                        file.save(os.path.join(upload_dir, filename))
                        image_paths.append(f"uploads/{filename}")

        if not current_user.is_authenticated:
            from flask import session
            count = session.get("guest_diagnosis_count", 0)
            if count >= 3:
                flash("You have reached the limit of 3 free diagnoses. Please register an account to continue.", "warning")
                return redirect(url_for("auth.login"))
            session["guest_diagnosis_count"] = count + 1

        diagnosis = Diagnosis(
            farmer_id=current_user.id if current_user.is_authenticated else None,
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
            prevention_recommendations=prevention_text,
            image_paths=image_paths if image_paths else None
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
            notify_user(
                user_id=current_user.id,
                kind="diagnosis_submitted",
                title="Diagnosis completed",
                subtitle=f"{crop.name}: Rule-based analysis is ready.",
                url=url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
                icon="fas fa-clipboard-check",
                level="success",
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
    diagnoses = []
    if current_user.is_authenticated:
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
        if not symptom.id or not symptom.name:
            continue
        name_en = _strip_khmer(symptom.name or "")
        name_kh = normalize_display_text(
            getattr(symptom, "name_kh", None) or "", lang="km"
        ) or ""
        symptoms_by_crop[0][symptom.id] = {"name": name_en, "name_kh": name_kh}

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
            name_en = _strip_khmer(symptom.name or "")
            name_kh = normalize_display_text(
                getattr(symptom, "name_kh", None) or "", lang="km"
            ) or ""
            symptoms_by_crop.setdefault(crop_id, {})
            symptoms_by_crop[crop_id][symptom.id] = {"name": name_en, "name_kh": name_kh}

        if rule_symptom_ids:
            rules_by_crop.setdefault(crop_id, [])
            rules_by_crop[crop_id].append(rule_symptom_ids)

    symptoms_by_crop_list = {}
    for cid, symptom_map in symptoms_by_crop.items():
        items = [
            {"id": str(sid), "name": v["name"], "name_kh": v["name_kh"]}
            for sid, v in symptom_map.items()
        ]
        items.sort(key=lambda x: x["name"].lower())
        symptoms_by_crop_list[str(cid)] = items

    from flask_wtf.csrf import generate_csrf
    bootstrap_data = {
        "postUrl": url_for("farmer.diagnose_rule_based"),
        "dashboardUrl": url_for("farmer.dashboard"),
        "chatUrl": url_for("farmer.chat"),
        "currentLang": current_lang,
        "csrfToken": generate_csrf(),
        "crops": [
            {
                "id": str(c.id),
                "name": c.name,
                "name_kh": c.name_kh or "",
                "emoji": c.emoji or "",
                "domainId": crop_profiles.get(c.id, {}).get("domain_id", "crop"),
                "subcategoryId": crop_profiles.get(c.id, {}).get("subcategory_id", "")
            }
            for c in crops
        ],
        "agriDomains": _agri_domains_payload(),
        "symptomsByCrop": symptoms_by_crop_list,
        "domainDefaultDiagnosisCategory": DOMAIN_DEFAULT_DIAGNOSIS_CATEGORY,
        "labels": {
            "selectCrop": t("select_crop"),
            "general": t("general"),
            "cameraSecureContext": t("camera_https_required"),
            "cameraUnsupported": t("camera_not_supported"),
            "cameraReady": t("camera_live_hint"),
            "cameraUnavailable": t("camera_unavailable"),
            "cameraCaptured": t("camera_success"),
            "pleaseSelectCrop": t("please_select_crop"),
            "invalidImageType": t("invalid_image_type"),
            "back": t("back"),
            "category": t("category"),
            "type": t("type"),
            "selectedCount": t("selected_count") if t("selected_count") else "{count} selected",
            "searchSymptom": t("search_symptom") if t("search_symptom") else "Search symptom",
            "noManualSelectionYet": t("no_manual_selection_yet") if t("no_manual_selection_yet") else "No symptoms selected yet.",
            "noSymptomsMatch": t("no_symptoms_match"),
            "noSymptoms": t("no_symptoms") if t("no_symptoms") else "No symptoms are available for this crop.",
            "freeTextNotes": t("symptom_text_label"),
            "fieldImage": t("field_image"),
            "maxUploadSize": t("max_upload_size"),
            "analyzeScan": t("analyze_scan") if t("analyze_scan") else "Analyze scan",
            "cameraOpen": t("camera_open"),
            "cameraStop": t("camera_stop"),
            "cameraCapture": t("camera_capture"),
            "cameraSwitch": t("camera_switch"),
            "diagnoseNow": t("diagnose_now"),
            "pageTitle": t("guided_diagnosis_title"),
            "pageSubtitle": t("guided_diagnosis_sub"),
            "stepCropLabel": t("select_crop") if t("select_crop") else "Select Crop",
            "stepCropDesc": t("select_crop_to_begin") if t("select_crop_to_begin") else "Select crop to begin",
            "stepContextLabel": t("diagnosis_information") if t("diagnosis_information") else "Context",
            "stepContextDesc": t("guided_diagnosis_sub") if t("guided_diagnosis_sub") else "Select diagnosis context",
            "stepSymptomsLabel": t("symptoms_label") if t("symptoms_label") else "Symptoms",
            "stepSymptomsDesc": t("symptom_picker_sub") if t("symptom_picker_sub") else "Choose symptoms",
            "stepReviewLabel": t("review") if t("review") else "Review",
            "stepReviewDesc": t("describe_issue") if t("describe_issue") else "Add notes and submit",
            "selectedText": t("selected"),
            "chooseCropText": t("choose_crop"),
            "guidedDiagnosis": t("guided_diagnosis"),
            "completeEachStep": t("complete_each_step"),
            "stepProgress": t("step_progress"),
            "symptomSelectedHint": t("symptom_selected_hint"),
            "symptomUnselectedHint": t("symptom_unselected_hint"),
            "cropClearedNotice": t("crop_cleared_notice"),
            "aiPoweredSystem": t("ai_powered_system"),
            "askExpert": t("ask_expert"),
            "formErrorTitle": t("form_error_title"),
            "step1": t("step1"),
            "step2": t("step2"),
            "step3": t("step3"),
            "step4": t("step4"),
            "currentContext": t("current_context"),
            "allCropGroups": t("all_crop_groups"),
            "selection": t("selection"),
            "noCropSelectedYet": t("no_crop_selected_yet"),
            "searchCrops": t("search_crops"),
            "searchByCropName": t("search_by_crop_name"),
            "showingMatchingCrops": t("showing_matching_crops"),
            "generalCrop": t("general_crop"),
            "noCropsMatch": t("no_crops_match"),
            "noCropsMatchDesc": t("no_crops_match_desc"),
            "selectedCrop": t("selected_crop"),
            "categoryDesc": t("category_desc"),
            "generalTypeDesc": t("general_type_desc"),
            "subcategoryDesc": t("subcategory_desc"),
            "contextStepHint": t("context_step_hint"),
            "selectedSummary": t("selected_summary"),
            "noSymptomsMatchDesc": t("no_symptoms_match_desc"),
            "noSymptomsDesc": t("no_symptoms_desc"),
            "reviewSelectionEmpty": t("review_selection_empty"),
            "cropColon": t("crop_colon"),
            "reviewSymptomsEmpty": t("review_symptoms_empty"),
            "diagnosisMode": t("diagnosis_mode"),
            "ruleBasedAnalysis": t("rule_based_analysis"),
            "reviewModeDesc": t("review_mode_desc"),
            "freeTextNotesDesc": t("free_text_notes_desc"),
            "freeTextNotesPlaceholder": t("free_text_notes_placeholder"),
            "imageUpload": t("image_upload"),
            "imageUploadScanDesc": t("image_upload_scan_desc"),
            "imageUploadManualDesc": t("image_upload_manual_desc"),
            "fieldPreviewAlt": t("field_preview_alt"),
            "noFieldImageScan": t("no_field_image_scan"),
            "noFieldImageManual": t("no_field_image_manual"),
            "removeImage": t("remove_image"),
            "liveCamera": t("live_camera"),
            "captureFromDeviceCamera": t("capture_from_device_camera"),
            "liveCameraDesc": t("live_camera_desc"),
            "progressSavedHint": t("progress_saved_hint"),
            "submitEndpointHint": t("submit_endpoint_hint"),
            "analyzing": t("analyzing")
        }
    }

    return render_template(
        "farmer/diagnose_rule_based.html",
        bootstrap_data=bootstrap_data
    )

# ===============================
# DIAGNOSIS RESULT
# ===============================
@farmer_bp.route("/result/<int:diagnosis_id>")
def diagnosis_result(diagnosis_id):
    """
    Show diagnosis result (owner only or guest)
    """

    diagnosis = Diagnosis.query.get(diagnosis_id)
    if not diagnosis:
        flash("Diagnosis record not found.", "info")
        return redirect(url_for("farmer.dashboard"))

    # Security: owner only if it belongs to a user
    if diagnosis.farmer_id is not None:
        if not current_user.is_authenticated or diagnosis.farmer_id != current_user.id:
            flash("Access denied.", "danger")
            return redirect(url_for("farmer.dashboard"))

    # Sidebar: recent diagnoses
    if current_user.is_authenticated:
        diagnoses = (
            Diagnosis.query
            .filter_by(farmer_id=current_user.id)
            .order_by(Diagnosis.created_at.desc())
            .limit(10)
            .all()
        )
    else:
        diagnoses = []

    possible_diseases = []
    if diagnosis.crop_id:
        possible_diseases = (
            Disease.query
            .filter_by(crop_id=diagnosis.crop_id)
            .order_by(Disease.name.asc())
            .all()
        )

    symptom_breakdown = _build_symptom_breakdown(diagnosis, limit=5)

    symptom_translations = {}
    if get_current_language() == "km":
        s_list = Symptom.query.all()
        symptom_translations = {s.name.lower().strip(): s.name_kh for s in s_list if s.name and s.name_kh}

    return render_template(
        "farmer/result.html",
        diagnosis=diagnosis,
        diagnoses=diagnoses,
        possible_diseases=possible_diseases,
        symptom_breakdown=symptom_breakdown,
        symptom_translations=symptom_translations,
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
        .first()
    )
    if not session:
        if sessions:
            return redirect(url_for("farmer.chat", session_id=sessions[0].id))
        return redirect(url_for("farmer.new_chat"))

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

@farmer_bp.route("/detail")
def detail():
    return render_template(
        "farmer/detail.html",
        supervisor=PROJECT_SUPERVISOR,
        team=PROJECT_TEAM,
    )

# ---------------------------------------------------------------------------
# NEWS (AI GENERATED & CURATED)
# ---------------------------------------------------------------------------
@farmer_bp.route("/news")
@login_required
def news():
    marquee_list = []
    active_marquees = []
    try:
        from app.models.marquee import Marquee
        active_marquees = Marquee.query.filter_by(is_active=True).order_by(Marquee.sort_order).all()
        marquee_list = [
            {
                "id": m.id,
                "text": m.text,
                "text_kh": m.text_kh,
                "created_at": m.created_at.strftime("%Y-%m-%d") if m.created_at else ""
            }
            for m in active_marquees
        ]
    except Exception as e:
        current_app.logger.warning(f"Marquee loading skipped or table missing: {e}")

    from app.services.openai_assistant import generate_agriculture_news
    lang = get_current_language()
    initial_news = generate_agriculture_news(region="cambodia", lang=lang)

    return render_template(
        "farmer/news.html",
        marquees=active_marquees,
        marquees_data=marquee_list,
        initial_news=initial_news
    )

@farmer_bp.route("/api/generate_news")
@login_required
def api_generate_news():
    region = request.args.get("region", "cambodia").strip().lower()
    lang = request.args.get("lang", "en").strip().lower()
    force = request.args.get("force", "false").strip().lower() in ("true", "1")
    from app.services.openai_assistant import generate_agriculture_news
    news_data = generate_agriculture_news(region=region, lang=lang, force_refresh=force)

    marquee_list = []
    try:
        from app.models.marquee import Marquee
        active_marquees = Marquee.query.filter_by(is_active=True).order_by(Marquee.sort_order).all()
        marquee_list = [
            {
                "id": m.id,
                "text": m.text,
                "text_kh": m.text_kh,
                "created_at": m.created_at.strftime("%Y-%m-%d") if m.created_at else ""
            }
            for m in active_marquees
        ]
    except Exception as e:
        current_app.logger.warning(f"Marquee loading skipped for API: {e}")

    return jsonify({
        "news": news_data,
        "marquees": marquee_list
    })

_TTS_CACHE = {}

@farmer_bp.route("/api/tts")
def api_tts():
    """Provides universal, natural-sounding Khmer and English audio narration for all devices (including MacBook and PC laptops)."""
    text = request.args.get("text", "").strip()
    lang = request.args.get("lang", "km").strip().lower()
    if not text:
        return ("No text provided", 400)

    import hashlib
    import requests
    import urllib.parse
    import re
    from flask import Response
    from concurrent.futures import ThreadPoolExecutor

    # Normalize language code (e.g. 'km-kh' -> 'km', 'en-us' -> 'en')
    if lang.startswith("km"):
        lang = "km"
    elif lang.startswith("en"):
        lang = "en"

    cache_key = hashlib.md5(f"{lang}:{text}".encode("utf-8")).hexdigest()
    if cache_key in _TTS_CACHE:
        return Response(
            _TTS_CACHE[cache_key],
            mimetype="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
                "Content-Length": str(len(_TTS_CACHE[cache_key]))
            }
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
    }

    # Split text into bite-sized sentence chunks <= 130 characters (Google Translate TTS max is ~180)
    raw_sentences = re.split(r'(?<=[។\.\n\?\!,;])\s*', text)
    chunks = []
    current_chunk = ""
    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
        while len(s) > 130:
            part = s[:125]
            sp_idx = part.rfind(" ")
            if sp_idx > 50:
                chunks.append(part[:sp_idx].strip())
                s = s[sp_idx:].strip()
            else:
                chunks.append(part)
                s = s[125:].strip()

        if len(current_chunk) + len(s) + 1 <= 130:
            current_chunk = (current_chunk + " " + s).strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = s
    if current_chunk:
        chunks.append(current_chunk)

    if not chunks:
        chunks = [text[:125]]

    # Limit to max 5 chunks to keep audio latency sub-second
    chunks = chunks[:5]

    def _fetch_tts_chunk(chunk_text):
        try:
            encoded = urllib.parse.quote(chunk_text)
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl={lang}&client=tw-ob&q={encoded}"
            resp = requests.get(url, headers=headers, timeout=3.5)
            if resp.status_code == 200 and resp.content:
                return resp.content
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as executor:
        chunk_results = list(executor.map(_fetch_tts_chunk, chunks))

    audio_data = bytearray()
    for res in chunk_results:
        if res:
            audio_data.extend(res)

    if audio_data:
        audio_bytes = bytes(audio_data)
        if len(_TTS_CACHE) > 200:
            _TTS_CACHE.pop(next(iter(_TTS_CACHE)))
        _TTS_CACHE[cache_key] = audio_bytes

        return Response(
            audio_bytes,
            mimetype="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
                "Content-Length": str(len(audio_bytes))
            }
        )

    return ("Audio narration unavailable", 500)

@farmer_bp.route("/premium/upgrade")
@farmer_required
def premium_upgrade():
    if current_user.is_authenticated and getattr(current_user, "is_premium", False):
        flash("You are already a Premium member!", "info")
        return redirect(url_for("farmer.dashboard"))
    from app.models.site_setting import SiteSetting
    price_setting = SiteSetting.query.get("premium_price")
    discount_setting = SiteSetting.query.get("premium_discount_percent")
    yearly_discount_setting = SiteSetting.query.get("premium_yearly_discount_percent")
    banner_setting = SiteSetting.query.get("premium_discount_banner")

    original_price = float(price_setting.value) if price_setting and price_setting.value else 20.0
    discount_percent = float(discount_setting.value) if discount_setting and discount_setting.value else 0.0
    yearly_discount_percent = float(yearly_discount_setting.value) if yearly_discount_setting and yearly_discount_setting.value else 20.0
    discount_banner = banner_setting.value if banner_setting else ""

    savings = round(original_price * (discount_percent / 100.0), 2) if discount_percent > 0 else 0.0
    final_price = f"{max(0.0, original_price - savings):.2f}"
    orig_price_str = f"{original_price:.2f}"

    return render_template(
        "farmer/upgrade.html",
        premium_price=final_price,
        original_price=orig_price_str,
        discount_percent=discount_percent,
        yearly_discount_percent=yearly_discount_percent,
        discount_banner=discount_banner,
        savings=savings
    )

@farmer_bp.route("/premium/checkout", methods=["GET", "POST"])
@farmer_required
def premium_checkout():
    if current_user.is_authenticated and getattr(current_user, "is_premium", False):
        flash("You are already a Premium member!", "info")
        return redirect(url_for("farmer.dashboard"))
        
    from app.models.site_setting import SiteSetting
    from app.models.premium_coupon import PremiumCoupon

    price_setting = SiteSetting.query.get("premium_price")
    discount_setting = SiteSetting.query.get("premium_discount_percent")
    yearly_discount_setting = SiteSetting.query.get("premium_yearly_discount_percent")
    coupon_setting = SiteSetting.query.get("premium_coupon_enabled")

    original_price = float(price_setting.value) if price_setting and price_setting.value else 20.0
    discount_percent = float(discount_setting.value) if discount_setting and discount_setting.value else 0.0
    yearly_discount_percent = float(yearly_discount_setting.value) if yearly_discount_setting and yearly_discount_setting.value else 20.0
    coupon_enabled = coupon_setting.value != "0" if coupon_setting else True

    savings = round(original_price * (discount_percent / 100.0), 2) if discount_percent > 0 else 0.0
    base_checkout_price = max(0.0, original_price - savings)

    billing_interval = request.args.get("billing", "monthly").strip().lower()
    is_yearly = (billing_interval == "yearly")

    if is_yearly:
        yearly_rate = round(base_checkout_price * (1.0 - yearly_discount_percent / 100.0) * 12, 2)
        display_checkout_price = f"{yearly_rate:.2f}"
        display_orig_price = f"{original_price * 12:.2f}"
    else:
        display_checkout_price = f"{base_checkout_price:.2f}"
        display_orig_price = f"{original_price:.2f}"
        
    if request.method == "POST":
        # Payment processing via PayPal frontend SDK success hidden form or direct checkout
        used_coupon_code = request.form.get("applied_coupon_code", "").strip().upper()
        if used_coupon_code:
            coupon = PremiumCoupon.query.filter_by(code=used_coupon_code).first()
            if coupon and coupon.is_valid()[0]:
                coupon.times_used += 1

        post_interval = request.form.get("billing_interval", billing_interval).strip().lower()
        days_to_add = 365 if post_interval == "yearly" else 30

        current_user.is_premium = True
        from datetime import datetime, timedelta
        current_user.premium_expires_at = datetime.utcnow() + timedelta(days=days_to_add)
        
        # Best effort user notification & audit log
        try:
            notify_user(
                user_id=current_user.id,
                kind="premium_upgrade",
                title="Premium Membership Activated!",
                subtitle="Welcome to Agri System Premium. Enjoy unlimited AI diagnoses, weather alerts, and 24/7 expert chat.",
                url=url_for("farmer.dashboard"),
                icon="fas fa-crown",
                level="success",
            )
        except Exception:
            pass

        try:
            log_action("farmer_premium_upgrade", detail=f"User @{current_user.username} upgraded to Premium ({post_interval}, expires {current_user.premium_expires_at.strftime('%Y-%m-%d')})")
        except Exception:
            pass

        db.session.commit()
        flash("Payment successful! Welcome to Agri System Premium.", "success")
        return redirect(url_for("farmer.dashboard"))
        
    import os
    paypal_client_id = os.getenv("PAYPAL_CLIENT_ID", "YOUR_PAYPAL_CLIENT_ID")
    return render_template(
        "farmer/checkout.html",
        paypal_client_id=paypal_client_id,
        premium_price=display_checkout_price,
        original_price=display_orig_price,
        discount_percent=discount_percent,
        yearly_discount_percent=yearly_discount_percent,
        savings=savings,
        coupon_enabled=coupon_enabled,
        billing_interval=billing_interval,
        is_yearly=is_yearly
    )

@farmer_bp.route("/api/validate-coupon", methods=["POST"])
@farmer_required
def validate_coupon():
    from app.models.site_setting import SiteSetting
    from app.models.premium_coupon import PremiumCoupon

    data = request.get_json() or {}
    code = data.get("code", "").strip().upper()

    if not code:
        return jsonify({"success": False, "message": "Please enter a coupon code."}), 400

    coupon = PremiumCoupon.query.filter_by(code=code).first()
    if not coupon:
        return jsonify({"success": False, "message": "Invalid coupon code."}), 404

    is_valid, msg = coupon.is_valid()
    if not is_valid:
        return jsonify({"success": False, "message": msg}), 400

    price_setting = SiteSetting.query.get("premium_price")
    discount_setting = SiteSetting.query.get("premium_discount_percent")

    original_price = float(price_setting.value) if price_setting and price_setting.value else 20.0
    discount_percent = float(discount_setting.value) if discount_setting and discount_setting.value else 0.0

    savings = round(original_price * (discount_percent / 100.0), 2) if discount_percent > 0 else 0.0
    current_price = max(0.0, original_price - savings)

    discount_amount, final_price = coupon.calculate_discount(current_price)

    return jsonify({
        "success": True,
        "code": coupon.code,
        "discount_type": coupon.discount_type,
        "discount_value": coupon.discount_value,
        "discount_amount": f"{discount_amount:.2f}",
        "final_price": f"{final_price:.2f}",
        "message": f"Coupon applied: {coupon.code} (-${discount_amount:.2f})"
    })


@farmer_bp.route("/redeem-code", methods=["POST"])
@farmer_required
def redeem_code():
    code_input = request.form.get("promo_code", "").strip().upper()
    if not code_input:
        flash("Please enter a code.", "danger")
        return redirect(url_for("user.settings"))
        
    from app.models.promo import PromoCode
    from datetime import datetime
    
    promo = PromoCode.query.filter(PromoCode.code.ilike(code_input)).first()
    
    if not promo:
        flash("Invalid reward code.", "danger")
        return redirect(url_for("user.settings"))
        
    if promo.is_used:
        flash("This reward code has already been used.", "danger")
        return redirect(url_for("user.settings"))
        
    # Apply reward
    promo.is_used = True
    promo.used_by_id = current_user.id
    promo.used_at = datetime.utcnow()
    
    from app.models.user import User
    user = User.query.get(current_user.id)
    user.ai_credits = (user.ai_credits or 0) + promo.tokens_reward
    db.session.add(promo)
    db.session.add(user)
    db.session.commit()
    
    flash(f"Success! You claimed {promo.tokens_reward} AI Tokens.", "success")
    return redirect(url_for("user.settings"))


# ===============================
# FARMER NOTIFICATIONS
# ===============================
@farmer_bp.route("/notifications", strict_slashes=False)
@farmer_bp.route("/notifications/", strict_slashes=False)
@farmer_bp.route("/notification", strict_slashes=False)
@farmer_bp.route("/notification/", strict_slashes=False)
@login_required
@farmer_required
def notifications():
    page = request.args.get("page", type=int) or 1
    per_page = request.args.get("per_page", 20, type=int)

    query = (
        Notification.query
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )

    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    next_page = page + 1 if (page * per_page) < total else None

    return render_template(
        "farmer/notifications.html",
        notifications_items=[serialize_notification(item) for item in rows],
        notifications_next_page=next_page,
        notifications_per_page=per_page,
    )


@farmer_bp.route("/mobile-help-center", strict_slashes=False)
@farmer_bp.route("/mobile-help-center/", strict_slashes=False)
def mobile_help_center():
    return redirect(url_for("farmer.dashboard"))


@farmer_bp.route("/notifications/data", strict_slashes=False)
@login_required
@farmer_required
def notifications_data():
    page = request.args.get("page", type=int) or 1
    per_page = request.args.get("per_page", 20, type=int)

    query = (
        Notification.query
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
    )

    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    next_page = page + 1 if (page * per_page) < total else None

    return jsonify({
        "ok": True,
        "items": [serialize_notification(item) for item in rows],
        "next_page": next_page,
        "per_page": per_page,
    })


@farmer_bp.route("/notifications/seen", methods=["POST"], strict_slashes=False)
@login_required
@farmer_required
def notifications_seen():
    payload = request.get_json(silent=True) or {}
    ids = payload.get("ids") if isinstance(payload, dict) else None

    query = (
        Notification.query
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
    )
    if ids:
        try:
            id_list = [int(val) for val in ids]
        except (TypeError, ValueError):
            id_list = []
        if id_list:
            query = query.filter(Notification.id.in_(id_list))

    from datetime import datetime
    updated = query.update({"read_at": datetime.utcnow()}, synchronize_session=False)
    db.session.commit()

    unread_count = (
        Notification.query
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .count()
    )

    return jsonify({
        "ok": True,
        "updated": updated,
        "unread_count": unread_count,
    })


@farmer_bp.route("/notifications/<int:notification_id>/read", methods=["POST"], strict_slashes=False)
@login_required
@farmer_required
def mark_notification_read(notification_id: int):
    notification = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first_or_404()
    from datetime import datetime
    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        db.session.commit()

    unread_count = (
        Notification.query
        .filter(
            Notification.user_id == current_user.id,
            Notification.read_at.is_(None),
        )
        .count()
    )

    return jsonify({
        "ok": True,
        "unread_count": unread_count,
    })

