from io import BytesIO
from datetime import datetime

from flask import (
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    url_for,
)
from flask_login import current_user, login_required
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.crop import Crop
from app.models.disease import Disease
from app.models.expert_question import ExpertQuestion
from app.models.expert_question_answer import ExpertQuestionAnswer
from app.models.symptom import Symptom
from app.utils.decorators import role_required

from . import expert_bp


QUESTION_CATEGORIES = [
    {"id": "symptoms", "label": "Symptoms"},
    {"id": "pests", "label": "Pests"},
    {"id": "diseases", "label": "Diseases"},
    {"id": "environment", "label": "Environment"},
]
QUESTION_CATEGORY_IDS = {item["id"] for item in QUESTION_CATEGORIES}

ANSWER_EFFECTS = [
    {"id": "none", "label": "No direct mapping"},
    {"id": "confirm_symptom", "label": "Confirm symptom"},
    {"id": "deny_symptom", "label": "Deny symptom"},
    {"id": "set_category", "label": "Set diagnosis category"},
]
ANSWER_EFFECT_IDS = {item["id"] for item in ANSWER_EFFECTS}

CONDITION_TYPES = [
    {"id": "if", "label": "IF"},
    {"id": "else", "label": "ELSE"},
    {"id": "branch", "label": "BRANCH"},
]
CONDITION_TYPE_IDS = {item["id"] for item in CONDITION_TYPES}

DIAGNOSIS_CATEGORIES = [
    {"id": "fungal", "label": "Fungal disease"},
    {"id": "bacterial", "label": "Bacterial disease"},
    {"id": "viral", "label": "Viral disease"},
    {"id": "pest", "label": "Pest / insect"},
    {"id": "nutrient", "label": "Nutrient deficiency"},
    {"id": "environment", "label": "Environment / water stress"},
    {"id": "other", "label": "Not sure"},
]
DIAGNOSIS_CATEGORY_IDS = {item["id"] for item in DIAGNOSIS_CATEGORIES}

QUESTION_IMAGE_MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
ALLOWED_QUESTION_IMAGE_EXTS = set(QUESTION_IMAGE_MIME_BY_EXT)
MAX_QUESTION_IMAGE_SIZE_BYTES = 4 * 1024 * 1024


def _parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_float(value, default=120.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _parse_bool(value) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "on", "yes"}


def _safe_crop_id(raw_crop_id):
    crop_id = _parse_int(raw_crop_id)
    if not crop_id:
        return None
    crop = Crop.query.get(crop_id)
    return crop.id if crop else None


def _allowed_next_question_ids():
    return {
        row.id
        for row in ExpertQuestion.query.with_entities(ExpertQuestion.id).all()
    }


def _ensure_rule_code(question: ExpertQuestion):
    if question.rule_code:
        return
    if not question.id:
        return
    question.rule_code = f"RULE-{question.id}"


def _sync_root_question(question: ExpertQuestion):
    if not question.is_root:
        return

    query = ExpertQuestion.query.filter(
        ExpertQuestion.is_root.is_(True),
        ExpertQuestion.id != question.id,
    )
    if question.crop_id:
        query = query.filter(ExpertQuestion.crop_id == question.crop_id)
    else:
        query = query.filter(ExpertQuestion.crop_id.is_(None))

    query.update({ExpertQuestion.is_root: False}, synchronize_session=False)


def _question_image_url(question: ExpertQuestion):
    if not question.image_data:
        return None
    return url_for("expert.question_builder_image", question_id=question.id)


def _serialize_preview_question(question: ExpertQuestion, question_ids: set[int]):
    answers_payload = []
    for answer in sorted(question.answers, key=lambda row: (row.sort_order, row.id)):
        next_question_id = answer.next_question_id if answer.next_question_id in question_ids else None
        is_terminal = bool(answer.is_terminal) or not next_question_id

        answers_payload.append(
            {
                "id": answer.id,
                "label": answer.label,
                "next_question_id": next_question_id,
                "is_terminal": is_terminal,
                "condition_type": answer.condition_type,
                "effect_type": answer.effect_type,
                "symptom_id": answer.symptom_id,
                "symptom_name": answer.symptom.name if answer.symptom else None,
                "category_value": answer.category_value,
                "final_diagnosis": answer.final_diagnosis,
                "note": answer.note,
            }
        )

    return {
        "id": question.id,
        "rule_code": question.rule_code,
        "prompt": question.prompt,
        "description": question.description,
        "category": question.category,
        "canvas_x": question.canvas_x,
        "canvas_y": question.canvas_y,
        "image_url": _question_image_url(question),
        "answers": answers_payload,
    }


def _extract_answers_from_request(*, current_question_id: int | None = None):
    answer_ids = request.form.getlist("answer_id")
    labels = request.form.getlist("answer_label")
    next_values = request.form.getlist("answer_next")
    condition_values = request.form.getlist("answer_condition")
    effects = request.form.getlist("answer_effect")
    symptom_values = request.form.getlist("answer_symptom")
    diagnosis_values = request.form.getlist("answer_diag_category")
    final_values = request.form.getlist("answer_final_diagnosis")
    notes = request.form.getlist("answer_note")
    sort_values = request.form.getlist("answer_order")

    total = max(
        len(answer_ids),
        len(labels),
        len(next_values),
        len(condition_values),
        len(effects),
        len(symptom_values),
        len(diagnosis_values),
        len(final_values),
        len(notes),
        len(sort_values),
    )

    rows = []
    errors = []

    if total == 0:
        return rows, ["Add at least two answers for each question."]

    allowed_next_ids = _allowed_next_question_ids()

    for idx in range(total):
        answer_id = _parse_int(answer_ids[idx] if idx < len(answer_ids) else None)
        label = (labels[idx] if idx < len(labels) else "").strip()
        next_raw = (next_values[idx] if idx < len(next_values) else "").strip()
        condition_type = (condition_values[idx] if idx < len(condition_values) else "branch").strip().lower()
        effect_type = (effects[idx] if idx < len(effects) else "none").strip() or "none"
        symptom_id = _parse_int(symptom_values[idx] if idx < len(symptom_values) else None)
        diagnosis_category = (
            diagnosis_values[idx] if idx < len(diagnosis_values) else ""
        ).strip().lower()
        final_diagnosis = (final_values[idx] if idx < len(final_values) else "").strip()
        note = (notes[idx] if idx < len(notes) else "").strip()
        sort_order = _parse_int(sort_values[idx] if idx < len(sort_values) else None)

        row_has_data = any(
            [
                label,
                next_raw,
                condition_type not in {"", "branch"},
                effect_type not in {"", "none"},
                symptom_id,
                diagnosis_category,
                final_diagnosis,
                note,
            ]
        )
        if not row_has_data:
            continue

        if not label:
            errors.append(f"Answer #{idx + 1}: label is required.")

        is_terminal = False
        next_question_id = None

        if not next_raw:
            errors.append(f"Answer #{idx + 1}: map to next question or choose End flow.")
        elif next_raw.lower() in {"__end__", "end"}:
            is_terminal = True
        else:
            next_question_id = _parse_int(next_raw)
            if not next_question_id:
                errors.append(f"Answer #{idx + 1}: invalid next question.")
            elif current_question_id and next_question_id == current_question_id:
                errors.append(f"Answer #{idx + 1}: next question cannot reference itself.")
            elif next_question_id not in allowed_next_ids:
                errors.append(f"Answer #{idx + 1}: selected next question does not exist.")

        if effect_type not in ANSWER_EFFECT_IDS:
            errors.append(f"Answer #{idx + 1}: invalid mapping type.")

        if condition_type not in CONDITION_TYPE_IDS:
            errors.append(f"Answer #{idx + 1}: invalid if/else branch type.")

        if effect_type in {"confirm_symptom", "deny_symptom"} and not symptom_id:
            errors.append(f"Answer #{idx + 1}: symptom is required for this mapping.")
        if effect_type not in {"confirm_symptom", "deny_symptom"}:
            symptom_id = None

        if effect_type == "set_category":
            if diagnosis_category not in DIAGNOSIS_CATEGORY_IDS:
                errors.append(f"Answer #{idx + 1}: diagnosis category is required.")
        else:
            diagnosis_category = None

        if not is_terminal:
            final_diagnosis = None
        elif final_diagnosis and len(final_diagnosis) > 200:
            final_diagnosis = final_diagnosis[:200]

        if note and len(note) > 200:
            note = note[:200]

        rows.append(
            {
                "id": answer_id,
                "label": label,
                "sort_order": sort_order if sort_order is not None else idx,
                "next_question_id": next_question_id,
                "is_terminal": is_terminal,
                "condition_type": condition_type if condition_type in CONDITION_TYPE_IDS else "branch",
                "effect_type": effect_type,
                "symptom_id": symptom_id,
                "category_value": diagnosis_category,
                "final_diagnosis": final_diagnosis or None,
                "note": note or None,
            }
        )

    if len(rows) < 2:
        errors.append("Each question must include at least two clickable answers.")

    return rows, errors


def _apply_question_image(question: ExpertQuestion):
    if _parse_bool(request.form.get("remove_image")):
        question.image_data = None
        question.image_mimetype = None

    upload = request.files.get("image_file")
    if not upload or not upload.filename:
        return None

    filename = upload.filename.lower()
    ext = ""
    if "." in filename:
        ext = filename[filename.rfind("."):]
    if ext not in ALLOWED_QUESTION_IMAGE_EXTS:
        return "Invalid image type. Please upload JPG, PNG, GIF, or WebP."

    image_bytes = upload.read() or b""
    if not image_bytes:
        return "Uploaded image is empty."

    if len(image_bytes) > MAX_QUESTION_IMAGE_SIZE_BYTES:
        return "Image is too large. Maximum size is 4MB."

    question.image_data = image_bytes
    question.image_mimetype = QUESTION_IMAGE_MIME_BY_EXT.get(ext, "image/jpeg")
    return None


def _form_context(*, question: ExpertQuestion | None = None):
    crops = Crop.query.order_by(Crop.name.asc()).all()
    symptoms = Symptom.query.order_by(Symptom.name.asc()).all()
    questions = (
        ExpertQuestion.query
        .options(selectinload(ExpertQuestion.crop))
        .order_by(ExpertQuestion.crop_id.asc(), ExpertQuestion.id.asc())
        .all()
    )

    return {
        "question": question,
        "crops": crops,
        "symptoms": symptoms,
        "next_questions": questions,
        "question_categories": QUESTION_CATEGORIES,
        "answer_effects": ANSWER_EFFECTS,
        "condition_types": CONDITION_TYPES,
        "diagnosis_categories": DIAGNOSIS_CATEGORIES,
    }


def _safe_scope_crop_id(raw_scope_crop_id):
    crop_id = _parse_int(raw_scope_crop_id)
    if not crop_id:
        return None
    crop = Crop.query.get(crop_id)
    return crop.id if crop else None


def _questions_for_scope(scope_crop_id):
    query = (
        ExpertQuestion.query
        .options(
            selectinload(ExpertQuestion.answers).selectinload(ExpertQuestionAnswer.symptom),
        )
        .order_by(ExpertQuestion.id.asc())
    )
    if scope_crop_id:
        query = query.filter(ExpertQuestion.crop_id == scope_crop_id)
    else:
        query = query.filter(ExpertQuestion.crop_id.is_(None))
    return query.all()


def _visual_payload_for_scope(scope_crop_id):
    questions = _questions_for_scope(scope_crop_id)
    question_ids = {question.id for question in questions}
    nodes = []

    for question in questions:
        answers = []
        for answer in sorted(question.answers, key=lambda row: (row.sort_order, row.id)):
            next_question_id = answer.next_question_id if answer.next_question_id in question_ids else None
            is_terminal = bool(answer.is_terminal) or not next_question_id
            answers.append(
                {
                    "id": answer.id,
                    "label": answer.label,
                    "sort_order": answer.sort_order,
                    "condition_type": answer.condition_type or "branch",
                    "next_node_id": f"q-{next_question_id}" if next_question_id else None,
                    "is_terminal": is_terminal,
                    "effect_type": answer.effect_type,
                    "symptom_id": answer.symptom_id,
                    "symptom_name": answer.symptom.name if answer.symptom else None,
                    "category_value": answer.category_value,
                    "final_diagnosis": answer.final_diagnosis,
                    "note": answer.note,
                }
            )

        nodes.append(
            {
                "id": f"q-{question.id}",
                "db_id": question.id,
                "rule_code": question.rule_code or f"RULE-{question.id}",
                "prompt": question.prompt,
                "category": question.category,
                "description": question.description,
                "is_root": bool(question.is_root),
                "is_active": bool(question.is_active),
                "canvas_x": question.canvas_x,
                "canvas_y": question.canvas_y,
                "answers": answers,
            }
        )

    return {
        "scope_crop_id": scope_crop_id,
        "nodes": nodes,
    }


def _serialize_symptoms(symptom_rows):
    return [
        {
            "id": symptom.id,
            "name": symptom.name,
            "name_kh": symptom.name_kh,
        }
        for symptom in symptom_rows
    ]


def _normalize_visual_payload(payload):
    if not isinstance(payload, dict):
        return None, ["Invalid flow payload."]

    scope_crop_id = _safe_scope_crop_id(payload.get("scope_crop_id"))
    raw_nodes = payload.get("nodes")
    if not isinstance(raw_nodes, list):
        return None, ["Flow nodes are required."]

    normalized_nodes = []
    errors = []
    seen_ids = set()

    for index, raw_node in enumerate(raw_nodes):
        if not isinstance(raw_node, dict):
            errors.append(f"Node #{index + 1}: invalid node data.")
            continue

        node_id = str(raw_node.get("id") or "").strip()
        if not node_id:
            errors.append(f"Node #{index + 1}: node id is required.")
            continue
        if node_id in seen_ids:
            errors.append(f"Node #{index + 1}: duplicate node id '{node_id}'.")
            continue
        seen_ids.add(node_id)

        prompt = str(raw_node.get("prompt") or "").strip()
        category = str(raw_node.get("category") or "symptoms").strip().lower()
        description = str(raw_node.get("description") or "").strip()

        if not prompt:
            errors.append(f"Node {node_id}: question text is required.")
        if category not in QUESTION_CATEGORY_IDS:
            errors.append(f"Node {node_id}: invalid category.")

        answers_raw = raw_node.get("answers")
        if not isinstance(answers_raw, list):
            errors.append(f"Node {node_id}: answers are required.")
            answers_raw = []
        if len(answers_raw) < 2:
            errors.append(f"Node {node_id}: at least two branches are required.")

        normalized_answers = []
        for answer_index, raw_answer in enumerate(answers_raw):
            if not isinstance(raw_answer, dict):
                errors.append(f"Node {node_id}, answer #{answer_index + 1}: invalid answer payload.")
                continue

            label = str(raw_answer.get("label") or "").strip()
            condition_type = str(raw_answer.get("condition_type") or "branch").strip().lower()
            effect_type = str(raw_answer.get("effect_type") or "none").strip().lower()
            next_node_id = str(raw_answer.get("next_node_id") or "").strip() or None
            is_terminal = bool(raw_answer.get("is_terminal")) or not next_node_id
            symptom_id = _parse_int(raw_answer.get("symptom_id"))
            category_value = str(raw_answer.get("category_value") or "").strip().lower() or None
            final_diagnosis = str(raw_answer.get("final_diagnosis") or "").strip() or None
            note = str(raw_answer.get("note") or "").strip() or None
            sort_order = _parse_int(raw_answer.get("sort_order"))
            answer_id = _parse_int(raw_answer.get("id"))

            if not label:
                errors.append(f"Node {node_id}, answer #{answer_index + 1}: label is required.")
            if condition_type not in CONDITION_TYPE_IDS:
                errors.append(f"Node {node_id}, answer '{label or answer_index + 1}': invalid if/else type.")
                condition_type = "branch"

            if effect_type not in ANSWER_EFFECT_IDS:
                errors.append(f"Node {node_id}, answer '{label or answer_index + 1}': invalid mapping type.")
                effect_type = "none"

            if effect_type in {"confirm_symptom", "deny_symptom"} and not symptom_id:
                errors.append(f"Node {node_id}, answer '{label or answer_index + 1}': symptom mapping is required.")
            if effect_type not in {"confirm_symptom", "deny_symptom"}:
                symptom_id = None

            if effect_type == "set_category":
                if category_value not in DIAGNOSIS_CATEGORY_IDS:
                    errors.append(
                        f"Node {node_id}, answer '{label or answer_index + 1}': diagnosis category is required."
                    )
            else:
                category_value = None

            if is_terminal:
                if not final_diagnosis:
                    errors.append(
                        f"Node {node_id}, answer '{label or answer_index + 1}': final diagnosis is required for stop conditions."
                    )
                next_node_id = None
            else:
                final_diagnosis = None

            if final_diagnosis and len(final_diagnosis) > 200:
                final_diagnosis = final_diagnosis[:200]
            if note and len(note) > 200:
                note = note[:200]

            normalized_answers.append(
                {
                    "id": answer_id,
                    "label": label,
                    "sort_order": sort_order if sort_order is not None else answer_index,
                    "condition_type": condition_type,
                    "effect_type": effect_type,
                    "next_node_id": next_node_id,
                    "is_terminal": is_terminal,
                    "symptom_id": symptom_id,
                    "category_value": category_value,
                    "final_diagnosis": final_diagnosis,
                    "note": note,
                }
            )

        condition_types = {item["condition_type"] for item in normalized_answers}
        if "if" in condition_types or "else" in condition_types:
            if "if" not in condition_types or "else" not in condition_types:
                errors.append(f"Node {node_id}: IF/ELSE mapping requires both IF and ELSE branches.")
            else_count = sum(1 for item in normalized_answers if item["condition_type"] == "else")
            if else_count > 1:
                errors.append(f"Node {node_id}: only one ELSE branch is allowed.")

        normalized_nodes.append(
            {
                "id": node_id,
                "db_id": _parse_int(raw_node.get("db_id")),
                "prompt": prompt,
                "category": category,
                "description": description or None,
                "is_root": bool(raw_node.get("is_root")),
                "is_active": bool(raw_node.get("is_active", True)),
                "canvas_x": _parse_float(raw_node.get("canvas_x"), 120.0),
                "canvas_y": _parse_float(raw_node.get("canvas_y"), 120.0),
                "answers": normalized_answers,
            }
        )

    if not normalized_nodes:
        errors.append("At least one question node is required.")

    root_nodes = [node for node in normalized_nodes if node["is_root"]]
    if len(root_nodes) != 1:
        errors.append("Exactly one root question is required for each flow scope.")

    node_ids = {node["id"] for node in normalized_nodes}
    for node in normalized_nodes:
        for answer in node["answers"]:
            if answer["is_terminal"]:
                continue
            if answer["next_node_id"] not in node_ids:
                errors.append(
                    f"Node {node['id']}, answer '{answer['label']}': next path references a missing question."
                )

    adjacency = {node["id"]: [] for node in normalized_nodes}
    for node in normalized_nodes:
        for answer in node["answers"]:
            if answer["is_terminal"] or not answer["next_node_id"]:
                continue
            adjacency[node["id"]].append(answer["next_node_id"])

    roots = [node["id"] for node in normalized_nodes if node["is_root"]]
    reachable = set()
    visiting = set()
    visited = set()

    def dfs(node_id):
        if node_id in visiting:
            errors.append(f"Cycle detected around node {node_id}.")
            return
        if node_id in visited:
            return
        visiting.add(node_id)
        visited.add(node_id)
        reachable.add(node_id)
        for next_id in adjacency.get(node_id, []):
            dfs(next_id)
        visiting.remove(node_id)

    for root_id in roots:
        dfs(root_id)

    unreachable = sorted(node_id for node_id in node_ids if node_id not in reachable)
    if unreachable:
        errors.append(
            "Unreachable question nodes detected: " + ", ".join(unreachable)
        )

    disease_query = Disease.query.with_entities(Disease.name, Disease.name_kh)
    if scope_crop_id:
        disease_query = disease_query.filter(Disease.crop_id == scope_crop_id)
    known_diagnoses = set()
    for disease_name, disease_name_kh in disease_query.all():
        for value in (disease_name, disease_name_kh):
            cleaned = str(value or "").strip().lower()
            if cleaned:
                known_diagnoses.add(cleaned)

    if not known_diagnoses:
        errors.append(
            "No diagnosis knowledge entries found for this flow scope. "
            "Add diseases in Expert > Diseases first."
        )
    else:
        for node in normalized_nodes:
            for answer in node["answers"]:
                if not answer["is_terminal"]:
                    continue
                final_diagnosis = str(answer["final_diagnosis"] or "").strip().lower()
                if final_diagnosis and final_diagnosis not in known_diagnoses:
                    errors.append(
                        f"Node {node['id']}, answer '{answer['label']}': "
                        f"final diagnosis '{answer['final_diagnosis']}' is not in Disease Knowledge Manager."
                    )

    if errors:
        return None, errors

    return {
        "scope_crop_id": scope_crop_id,
        "nodes": normalized_nodes,
    }, []


def _apply_visual_payload(validated_payload):
    scope_crop_id = validated_payload["scope_crop_id"]
    nodes = validated_payload["nodes"]

    existing_questions = _questions_for_scope(scope_crop_id)
    existing_by_id = {question.id: question for question in existing_questions}

    node_to_question = {}
    keep_question_ids = set()

    for node in nodes:
        db_id = node.get("db_id")
        question = existing_by_id.get(db_id) if db_id else None
        if question is None:
            question = ExpertQuestion(
                crop_id=scope_crop_id,
                created_by_id=current_user.id,
            )
            db.session.add(question)

        question.prompt = node["prompt"]
        question.category = node["category"]
        question.description = node["description"]
        question.is_root = node["is_root"]
        question.is_active = node["is_active"]
        question.canvas_x = node["canvas_x"]
        question.canvas_y = node["canvas_y"]
        question.updated_by_id = current_user.id

        db.session.flush()
        _ensure_rule_code(question)

        node_to_question[node["id"]] = question
        keep_question_ids.add(question.id)

    for question in existing_questions:
        if question.id not in keep_question_ids:
            incoming = (
                ExpertQuestionAnswer.query
                .filter(ExpertQuestionAnswer.next_question_id == question.id)
                .all()
            )
            for answer in incoming:
                answer.next_question_id = None
                answer.is_terminal = True
                answer.final_diagnosis = answer.final_diagnosis or "Manual final diagnosis required."
            db.session.delete(question)

    for node in nodes:
        question = node_to_question[node["id"]]
        existing_answers = {answer.id: answer for answer in question.answers}
        keep_answer_ids = set()

        for answer_payload in node["answers"]:
            answer_id = answer_payload.get("id")
            answer = existing_answers.get(answer_id) if answer_id else None
            if answer is None:
                answer = ExpertQuestionAnswer(question_id=question.id)
                db.session.add(answer)

            next_question_id = None
            if not answer_payload["is_terminal"] and answer_payload["next_node_id"]:
                target_question = node_to_question.get(answer_payload["next_node_id"])
                next_question_id = target_question.id if target_question else None

            answer.label = answer_payload["label"]
            answer.sort_order = answer_payload["sort_order"]
            answer.condition_type = answer_payload["condition_type"]
            answer.effect_type = answer_payload["effect_type"]
            answer.next_question_id = next_question_id
            answer.is_terminal = bool(answer_payload["is_terminal"] or not next_question_id)
            answer.symptom_id = answer_payload["symptom_id"]
            answer.category_value = answer_payload["category_value"]
            answer.final_diagnosis = answer_payload["final_diagnosis"] if answer.is_terminal else None
            answer.note = answer_payload["note"]

            db.session.flush()
            keep_answer_ids.add(answer.id)

        for answer_id, answer in existing_answers.items():
            if answer_id not in keep_answer_ids:
                db.session.delete(answer)


@expert_bp.route("/question-builder/visual")
@role_required("expert")
def question_builder_visual_editor():
    scope_crop_id = _safe_scope_crop_id(request.args.get("crop_id"))
    crops = Crop.query.order_by(Crop.name.asc()).all()
    symptoms = _serialize_symptoms(
        Symptom.query.order_by(Symptom.name.asc()).all()
    )

    scopes = [{"key": "global", "label": "Global (all crops)", "crop_id": None}]
    scopes.extend(
        [
            {
                "key": str(crop.id),
                "label": crop.name,
                "crop_id": crop.id,
            }
            for crop in crops
        ]
    )

    flow_data = {
        scope["key"]: _visual_payload_for_scope(scope["crop_id"])
        for scope in scopes
    }

    initial_scope_key = str(scope_crop_id) if scope_crop_id else "global"
    if initial_scope_key not in flow_data:
        initial_scope_key = "global"

    return render_template(
        "expert/question_builder/visual_editor.html",
        flow_data=flow_data,
        scopes=scopes,
        initial_scope_key=initial_scope_key,
        question_categories=QUESTION_CATEGORIES,
        answer_effects=ANSWER_EFFECTS,
        condition_types=CONDITION_TYPES,
        diagnosis_categories=DIAGNOSIS_CATEGORIES,
        symptoms=symptoms,
    )


@expert_bp.route("/question-builder/visual/validate", methods=["POST"])
@role_required("expert")
def question_builder_visual_validate():
    payload = request.get_json(silent=True) or {}
    validated_payload, errors = _normalize_visual_payload(payload)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400
    return jsonify({"ok": True, "errors": [], "node_count": len(validated_payload["nodes"])})


@expert_bp.route("/question-builder/visual/save", methods=["POST"])
@role_required("expert")
def question_builder_visual_save():
    payload = request.get_json(silent=True) or {}
    validated_payload, errors = _normalize_visual_payload(payload)
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    _apply_visual_payload(validated_payload)
    db.session.commit()

    refreshed_payload = _visual_payload_for_scope(validated_payload["scope_crop_id"])
    return jsonify(
        {
            "ok": True,
            "message": "Flow saved successfully.",
            "payload": refreshed_payload,
        }
    )


@expert_bp.route("/question-builder")
@role_required("expert")
def question_builder_dashboard():
    crop_id = request.args.get("crop_id", type=int)
    category = (request.args.get("category") or "").strip().lower()
    active_filter = (request.args.get("active") or "").strip().lower()
    q = (request.args.get("q") or "").strip()

    query = (
        ExpertQuestion.query
        .options(
            selectinload(ExpertQuestion.crop),
            selectinload(ExpertQuestion.answers).selectinload(ExpertQuestionAnswer.next_question),
            selectinload(ExpertQuestion.answers).selectinload(ExpertQuestionAnswer.symptom),
        )
    )

    if crop_id:
        query = query.filter(ExpertQuestion.crop_id == crop_id)
    if category in QUESTION_CATEGORY_IDS:
        query = query.filter(ExpertQuestion.category == category)
    if active_filter == "active":
        query = query.filter(ExpertQuestion.is_active.is_(True))
    elif active_filter == "inactive":
        query = query.filter(ExpertQuestion.is_active.is_(False))
    if q:
        query = query.filter(ExpertQuestion.prompt.ilike(f"%{q}%"))

    questions = query.order_by(ExpertQuestion.updated_at.desc()).all()

    total_questions = ExpertQuestion.query.count()
    active_questions = ExpertQuestion.query.filter(ExpertQuestion.is_active.is_(True)).count()
    root_questions = ExpertQuestion.query.filter(ExpertQuestion.is_root.is_(True)).count()
    answer_count = ExpertQuestionAnswer.query.count()

    crops = Crop.query.order_by(Crop.name.asc()).all()

    return render_template(
        "expert/question_builder/dashboard.html",
        questions=questions,
        crops=crops,
        question_categories=QUESTION_CATEGORIES,
        filters={
            "crop_id": crop_id,
            "category": category,
            "active": active_filter,
            "q": q,
        },
        stats={
            "total_questions": total_questions,
            "active_questions": active_questions,
            "root_questions": root_questions,
            "answer_count": answer_count,
        },
    )


@expert_bp.route("/question-builder/new", methods=["GET", "POST"])
@role_required("expert")
def question_builder_create():
    if request.method == "POST":
        prompt = (request.form.get("prompt") or "").strip()
        category = (request.form.get("category") or "symptoms").strip().lower()
        description = (request.form.get("description") or "").strip()
        crop_id = _safe_crop_id(request.form.get("crop_id"))
        is_root = _parse_bool(request.form.get("is_root"))
        is_active = _parse_bool(request.form.get("is_active"))

        answers_payload, answer_errors = _extract_answers_from_request(current_question_id=None)

        if not prompt:
            answer_errors.append("Question text is required.")
        if category not in QUESTION_CATEGORY_IDS:
            answer_errors.append("Invalid question category.")

        question = ExpertQuestion(
            prompt=prompt,
            category=category,
            description=description or None,
            crop_id=crop_id,
            canvas_x=_parse_float(request.form.get("canvas_x"), 120.0),
            canvas_y=_parse_float(request.form.get("canvas_y"), 120.0),
            is_root=is_root,
            is_active=is_active,
            created_by_id=current_user.id,
            updated_by_id=current_user.id,
        )

        image_error = _apply_question_image(question)
        if image_error:
            answer_errors.append(image_error)

        if answer_errors:
            for error in answer_errors:
                flash(error, "danger")
            return render_template(
                "expert/question_builder/form.html",
                is_edit=False,
                now=datetime.utcnow(),
                **_form_context(question=question),
            )

        db.session.add(question)
        db.session.flush()
        _ensure_rule_code(question)

        for row in answers_payload:
            db.session.add(
                ExpertQuestionAnswer(
                    question_id=question.id,
                    label=row["label"],
                    sort_order=row["sort_order"],
                    next_question_id=row["next_question_id"],
                    condition_type=row["condition_type"],
                    effect_type=row["effect_type"],
                    symptom_id=row["symptom_id"],
                    category_value=row["category_value"],
                    is_terminal=row["is_terminal"],
                    final_diagnosis=row["final_diagnosis"],
                    note=row["note"],
                )
            )

        _sync_root_question(question)
        db.session.commit()

        flash("Question saved successfully.", "success")
        return redirect(url_for("expert.question_builder_dashboard"))

    return render_template(
        "expert/question_builder/form.html",
        is_edit=False,
        now=datetime.utcnow(),
        **_form_context(question=None),
    )


@expert_bp.route("/question-builder/<int:question_id>/edit", methods=["GET", "POST"])
@role_required("expert")
def question_builder_edit(question_id):
    question = (
        ExpertQuestion.query
        .options(selectinload(ExpertQuestion.answers))
        .get_or_404(question_id)
    )

    if request.method == "POST":
        prompt = (request.form.get("prompt") or "").strip()
        category = (request.form.get("category") or "symptoms").strip().lower()
        description = (request.form.get("description") or "").strip()
        crop_id = _safe_crop_id(request.form.get("crop_id"))
        is_root = _parse_bool(request.form.get("is_root"))
        is_active = _parse_bool(request.form.get("is_active"))

        answers_payload, answer_errors = _extract_answers_from_request(
            current_question_id=question.id,
        )

        if not prompt:
            answer_errors.append("Question text is required.")
        if category not in QUESTION_CATEGORY_IDS:
            answer_errors.append("Invalid question category.")

        question.prompt = prompt
        question.category = category
        question.description = description or None
        question.crop_id = crop_id
        question.canvas_x = _parse_float(request.form.get("canvas_x"), question.canvas_x or 120.0)
        question.canvas_y = _parse_float(request.form.get("canvas_y"), question.canvas_y or 120.0)
        question.is_root = is_root
        question.is_active = is_active
        question.updated_by_id = current_user.id
        _ensure_rule_code(question)

        image_error = _apply_question_image(question)
        if image_error:
            answer_errors.append(image_error)

        existing = {answer.id: answer for answer in question.answers}
        keep_ids = set()

        for row in answers_payload:
            answer_id = row["id"]
            if answer_id and answer_id in existing:
                answer = existing[answer_id]
                answer.label = row["label"]
                answer.sort_order = row["sort_order"]
                answer.next_question_id = row["next_question_id"]
                answer.condition_type = row["condition_type"]
                answer.effect_type = row["effect_type"]
                answer.symptom_id = row["symptom_id"]
                answer.category_value = row["category_value"]
                answer.is_terminal = row["is_terminal"]
                answer.final_diagnosis = row["final_diagnosis"]
                answer.note = row["note"]
                keep_ids.add(answer_id)
                continue

            db.session.add(
                ExpertQuestionAnswer(
                    question_id=question.id,
                    label=row["label"],
                    sort_order=row["sort_order"],
                    next_question_id=row["next_question_id"],
                    condition_type=row["condition_type"],
                    effect_type=row["effect_type"],
                    symptom_id=row["symptom_id"],
                    category_value=row["category_value"],
                    is_terminal=row["is_terminal"],
                    final_diagnosis=row["final_diagnosis"],
                    note=row["note"],
                )
            )

        for answer_id, answer in existing.items():
            if answer_id not in keep_ids:
                db.session.delete(answer)

        if answer_errors:
            db.session.rollback()
            for error in answer_errors:
                flash(error, "danger")
            return render_template(
                "expert/question_builder/form.html",
                is_edit=True,
                now=datetime.utcnow(),
                **_form_context(question=question),
            )

        _sync_root_question(question)
        db.session.commit()

        flash("Question updated successfully.", "success")
        return redirect(url_for("expert.question_builder_dashboard"))

    return render_template(
        "expert/question_builder/form.html",
        is_edit=True,
        now=datetime.utcnow(),
        **_form_context(question=question),
    )


@expert_bp.route("/question-builder/<int:question_id>/delete", methods=["POST"])
@role_required("expert")
def question_builder_delete(question_id):
    question = ExpertQuestion.query.get_or_404(question_id)

    incoming = (
        ExpertQuestionAnswer.query
        .filter(ExpertQuestionAnswer.next_question_id == question.id)
        .all()
    )
    for answer in incoming:
        answer.next_question_id = None
        answer.is_terminal = True
        answer.final_diagnosis = answer.final_diagnosis or "Manual final diagnosis required."

    was_root = question.is_root
    question_crop_id = question.crop_id

    db.session.delete(question)
    db.session.flush()

    if was_root:
        replacement_q = ExpertQuestion.query
        if question_crop_id:
            replacement_q = replacement_q.filter(ExpertQuestion.crop_id == question_crop_id)
        else:
            replacement_q = replacement_q.filter(ExpertQuestion.crop_id.is_(None))
        replacement = replacement_q.order_by(ExpertQuestion.is_active.desc(), ExpertQuestion.id.asc()).first()
        if replacement:
            replacement.is_root = True

    db.session.commit()

    flash("Question deleted.", "warning")
    return redirect(url_for("expert.question_builder_dashboard"))


@expert_bp.route("/question-builder/<int:question_id>/preview")
@role_required("expert")
def question_builder_preview(question_id):
    question = (
        ExpertQuestion.query
        .options(selectinload(ExpertQuestion.crop))
        .get_or_404(question_id)
    )

    query = (
        ExpertQuestion.query
        .options(
            selectinload(ExpertQuestion.answers).selectinload(ExpertQuestionAnswer.symptom)
        )
        .filter(ExpertQuestion.is_active.is_(True))
    )

    if question.crop_id:
        query = query.filter(
            or_(
                ExpertQuestion.crop_id == question.crop_id,
                ExpertQuestion.crop_id.is_(None),
            )
        )
    else:
        query = query.filter(ExpertQuestion.crop_id.is_(None))

    questions = query.order_by(ExpertQuestion.id.asc()).all()

    if question not in questions:
        questions.append(question)

    question_ids = {row.id for row in questions}
    payload = {
        str(row.id): _serialize_preview_question(row, question_ids)
        for row in questions
    }

    return render_template(
        "expert/question_builder/preview.html",
        question=question,
        questions_payload=payload,
    )


@expert_bp.route("/question-builder/image/<int:question_id>")
@login_required
def question_builder_image(question_id):
    question = ExpertQuestion.query.get_or_404(question_id)
    if not question.image_data:
        abort(404)

    response = send_file(
        BytesIO(question.image_data),
        mimetype=question.image_mimetype or "image/jpeg",
        as_attachment=False,
        max_age=0,
        conditional=False,
    )
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response
