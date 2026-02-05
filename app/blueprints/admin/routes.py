# app/blueprints/admin/routes.py

import os
import csv
import json
import zipfile
from datetime import datetime
from io import StringIO, BytesIO

from flask import (
    Blueprint,
    render_template,
    redirect,
    url_for,
    flash,
    request,
    Response,
    jsonify,
    abort
)
from flask_login import login_required, current_user
from sqlalchemy import or_

from app.extensions import db
from app.utils.decorators import permission_required

from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.audit_log import AuditLog
from app.models.diagnosis import Diagnosis
from app.models.chat_message import ChatMessage
from app.models.crop import Crop
from app.models.disease import Disease
from app.models.symptom import Symptom
from app.models.translation_backup import TranslationBackup
from app.services.translator import translate_to_khmer

admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/admin"
)


def _user_row(user):
    roles = ", ".join(sorted({role.name for role in user.roles})) if user.roles else ""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": roles,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _csv_response(rows, fieldnames, filename):
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: "" if v is None else v for k, v in row.items()})
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _json_response(payload, filename):
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    return Response(
        content,
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _zip_response(files, filename):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    buffer.seek(0)
    return Response(
        buffer.getvalue(),
        mimetype="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# ==================================================
# ADMIN DASHBOARD  ✅ UPDATED
# ==================================================
@admin_bp.route("/dashboard")
@login_required
@permission_required("view_dashboard")
def dashboard():
    recent_logs = (
        AuditLog.query
        .order_by(AuditLog.created_at.desc())
        .limit(8)
        .all()
    )

    scan_points = []
    cesium_token = os.getenv("CESIUM_TOKEN", "")

    return render_template(
        "admin/dashboard.html",
        total_users=User.query.count(),
        total_diagnoses=Diagnosis.query.count(),
        pending_diagnoses=Diagnosis.query.filter_by(status="PENDING").count(),
        total_chats=ChatMessage.query.count(),
        recent_logs=recent_logs,
        scan_points=scan_points,
        cesium_token=cesium_token
    )


# ==================================================
# 🌍 3D WORLD VIEW
# ==================================================
@admin_bp.route("/world")
@login_required
@permission_required("view_dashboard")
def world():
    scan_points = []
    cesium_token = os.getenv("CESIUM_TOKEN", "")
    return render_template(
        "admin/world.html",
        scan_points=scan_points,
        cesium_token=cesium_token
    )


# ==================================================
# 📊 EXPERT STATISTICS
# ==================================================
@admin_bp.route("/expert-statistics")
@login_required
@permission_required("view_reports")
def expert_statistics():
    total = Diagnosis.query.count()
    pending = Diagnosis.query.filter_by(status="PENDING").count()
    approved = Diagnosis.query.filter(
        Diagnosis.status != "PENDING"
    ).count()

    return render_template(
        "admin/expert_stats.html",
        total_diagnoses=total,
        pending_count=pending,
        approved_count=approved
    )


# ==================================================
# DISEASE MANAGEMENT
# ==================================================
@admin_bp.route("/diseases")
@login_required
@permission_required("manage_crops")
def diseases():
    diseases = Disease.query.order_by(Disease.id.desc()).all()
    return render_template(
        "admin/diseases.html",
        diseases=diseases
    )


@admin_bp.route("/diseases/create", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
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
        return redirect(url_for("admin.diseases"))

    return render_template(
        "admin/create_disease.html",
        crops=crops,
        back_url=url_for("admin.diseases")
    )


@admin_bp.route("/diseases/<int:disease_id>/edit", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
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
        return redirect(url_for("admin.diseases"))

    return render_template(
        "admin/create_disease.html",
        crops=crops,
        disease=disease,
        edit_mode=True,
        back_url=url_for("admin.diseases")
    )


@admin_bp.route("/diseases/<int:disease_id>/delete", methods=["POST"])
@login_required
@permission_required("manage_crops")
def delete_disease(disease_id):
    disease = Disease.query.get_or_404(disease_id)
    db.session.delete(disease)
    db.session.commit()

    flash("Disease deleted", "warning")
    return redirect(url_for("admin.diseases"))


@admin_bp.route("/diseases/bulk", methods=["POST"])
@login_required
@permission_required("manage_crops")
def diseases_bulk():
    action = request.form.get("action")
    scope = request.form.get("scope", "selected")

    if action != "delete":
        flash("Select a bulk action", "danger")
        return redirect(url_for("admin.diseases"))

    if scope == "all":
        diseases = Disease.query.all()
    else:
        disease_ids = request.form.getlist("disease_ids")
        if not disease_ids:
            flash("Select at least one disease", "warning")
            return redirect(url_for("admin.diseases"))
        diseases = Disease.query.filter(Disease.id.in_(disease_ids)).all()

    if not diseases:
        flash("No diseases found to delete", "warning")
        return redirect(url_for("admin.diseases"))

    for disease in diseases:
        db.session.delete(disease)
    db.session.commit()

    flash(f"Deleted {len(diseases)} disease(s)", "warning")
    return redirect(url_for("admin.diseases"))


# ==================================================
# TRANSLATION CENTER
# ==================================================
_TRANSLATION_RATE_LIMIT = {
    "window_seconds": 60,
    "max_requests": 40,
    "buckets": {},
}


def _rate_limited(ip: str) -> bool:
    now = datetime.utcnow().timestamp()
    bucket = _TRANSLATION_RATE_LIMIT["buckets"].get(ip)
    if not bucket or now - bucket["start"] > _TRANSLATION_RATE_LIMIT["window_seconds"]:
        _TRANSLATION_RATE_LIMIT["buckets"][ip] = {"start": now, "count": 1}
        return False
    bucket["count"] += 1
    return bucket["count"] > _TRANSLATION_RATE_LIMIT["max_requests"]


def _save_translation_backup(scope: str, payload: dict):
    backup = TranslationBackup(scope=scope, payload=json.dumps(payload, ensure_ascii=False))
    db.session.add(backup)
    # keep only the latest 20 backups
    old = (
        TranslationBackup.query
        .order_by(TranslationBackup.created_at.desc())
        .offset(20)
        .all()
    )
    for item in old:
        db.session.delete(item)

@admin_bp.route("/translations", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def translations():
    section = (request.values.get("section") or "").strip().lower() or "crops"
    missing_only = (request.values.get("missing") or "").strip().lower() == "1"
    q = (request.values.get("q") or "").strip()

    def _apply_filters(query, name_col, name_kh_col):
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    name_col.ilike(like),
                    name_kh_col.ilike(like)
                )
            )
        if missing_only:
            query = query.filter(or_(name_kh_col.is_(None), name_kh_col == ""))
        return query

    if request.method == "POST":
        action = (request.form.get("action") or "save").strip().lower()
        updated = 0

        if action == "export":
            export_section = (request.form.get("section") or "").strip().lower()
            if export_section not in {"crops", "diseases", "symptoms"}:
                flash("Select a valid section to export.", "warning")
                return redirect(url_for("admin.translations"))

            if export_section == "crops":
                query = _apply_filters(Crop.query, Crop.name, Crop.name_kh)
                rows = [
                    {
                        "id": c.id,
                        "name_en": c.name,
                        "name_kh": c.name_kh or "",
                        "description_en": c.description or "",
                        "description_kh": c.description_kh or "",
                    }
                    for c in query.order_by(Crop.name.asc()).all()
                ]
                fieldnames = ["id", "name_en", "name_kh", "description_en", "description_kh"]
                return _csv_response(rows, fieldnames, "translations_crops.csv")

            if export_section == "diseases":
                query = _apply_filters(Disease.query, Disease.name, Disease.name_kh)
                rows = [
                    {
                        "id": d.id,
                        "name_en": d.name,
                        "name_kh": d.name_kh or "",
                        "description_en": d.description or "",
                        "description_kh": d.description_kh or "",
                        "treatment_en": d.treatment or "",
                        "treatment_kh": d.treatment_kh or "",
                    }
                    for d in query.order_by(Disease.name.asc()).all()
                ]
                fieldnames = [
                    "id",
                    "name_en",
                    "name_kh",
                    "description_en",
                    "description_kh",
                    "treatment_en",
                    "treatment_kh",
                ]
                return _csv_response(rows, fieldnames, "translations_diseases.csv")

            query = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh)
            rows = [
                {
                    "id": s.id,
                    "name_en": s.name,
                    "name_kh": s.name_kh or "",
                    "description_en": s.description or "",
                    "description_kh": s.description_kh or "",
                }
                for s in query.order_by(Symptom.name.asc()).all()
            ]
            fieldnames = ["id", "name_en", "name_kh", "description_en", "description_kh"]
            return _csv_response(rows, fieldnames, "translations_symptoms.csv")

        if action == "export_all":
            crops = Crop.query.order_by(Crop.name.asc()).all()
            diseases = Disease.query.order_by(Disease.name.asc()).all()
            symptoms = Symptom.query.order_by(Symptom.name.asc()).all()

            crops_rows = [
                {
                    "id": c.id,
                    "name_en": c.name,
                    "name_kh": c.name_kh or "",
                    "description_en": c.description or "",
                    "description_kh": c.description_kh or "",
                }
                for c in crops
            ]
            crops_csv = StringIO()
            crop_writer = csv.DictWriter(
                crops_csv,
                fieldnames=["id", "name_en", "name_kh", "description_en", "description_kh"]
            )
            crop_writer.writeheader()
            for row in crops_rows:
                crop_writer.writerow(row)

            disease_rows = [
                {
                    "id": d.id,
                    "name_en": d.name,
                    "name_kh": d.name_kh or "",
                    "description_en": d.description or "",
                    "description_kh": d.description_kh or "",
                    "treatment_en": d.treatment or "",
                    "treatment_kh": d.treatment_kh or "",
                }
                for d in diseases
            ]
            disease_csv = StringIO()
            disease_writer = csv.DictWriter(
                disease_csv,
                fieldnames=[
                    "id",
                    "name_en",
                    "name_kh",
                    "description_en",
                    "description_kh",
                    "treatment_en",
                    "treatment_kh",
                ],
            )
            disease_writer.writeheader()
            for row in disease_rows:
                disease_writer.writerow(row)

            symptom_rows = [
                {
                    "id": s.id,
                    "name_en": s.name,
                    "name_kh": s.name_kh or "",
                    "description_en": s.description or "",
                    "description_kh": s.description_kh or "",
                }
                for s in symptoms
            ]
            symptom_csv = StringIO()
            symptom_writer = csv.DictWriter(
                symptom_csv,
                fieldnames=["id", "name_en", "name_kh", "description_en", "description_kh"]
            )
            symptom_writer.writeheader()
            for row in symptom_rows:
                symptom_writer.writerow(row)

            return _zip_response(
                {
                    "translations_crops.csv": crops_csv.getvalue(),
                    "translations_diseases.csv": disease_csv.getvalue(),
                    "translations_symptoms.csv": symptom_csv.getvalue(),
                },
                "translations_all.zip",
            )

        if action == "import":
            import_section = (request.form.get("section") or "").strip().lower()
            upload = request.files.get("file")
            if import_section not in {"crops", "diseases", "symptoms"} or not upload:
                flash("Select a valid section and CSV file to import.", "warning")
                return redirect(url_for("admin.translations"))
            try:
                content = upload.read().decode("utf-8")
            except Exception:
                flash("Unable to read CSV file.", "danger")
                return redirect(url_for("admin.translations"))
            reader = csv.DictReader(StringIO(content))
            if not reader.fieldnames:
                flash("CSV file is missing headers.", "danger")
                return redirect(url_for("admin.translations"))

            if import_section == "crops":
                snapshot = {
                    "scope": "crops",
                    "items": [
                        {
                            "id": c.id,
                            "name_kh": c.name_kh,
                            "description_kh": c.description_kh,
                        }
                        for c in Crop.query.order_by(Crop.id.asc()).all()
                    ],
                }
                _save_translation_backup("crops", snapshot)
                for row in reader:
                    try:
                        crop_id = int(row.get("id") or 0)
                    except (TypeError, ValueError):
                        continue
                    crop = Crop.query.get(crop_id)
                    if not crop:
                        continue
                    name_kh = (row.get("name_kh") or "").strip() or None
                    desc_kh = (row.get("description_kh") or "").strip() or None
                    if crop.name_kh != name_kh:
                        crop.name_kh = name_kh
                        updated += 1
                    if crop.description_kh != desc_kh:
                        crop.description_kh = desc_kh
                        updated += 1
                db.session.commit()
                flash(f"Imported {updated} crop field(s).", "success")
                return redirect(url_for("admin.translations") + "#crops")

            if import_section == "diseases":
                snapshot = {
                    "scope": "diseases",
                    "items": [
                        {
                            "id": d.id,
                            "name_kh": d.name_kh,
                            "description_kh": d.description_kh,
                            "treatment_kh": d.treatment_kh,
                        }
                        for d in Disease.query.order_by(Disease.id.asc()).all()
                    ],
                }
                _save_translation_backup("diseases", snapshot)
                for row in reader:
                    try:
                        disease_id = int(row.get("id") or 0)
                    except (TypeError, ValueError):
                        continue
                    disease = Disease.query.get(disease_id)
                    if not disease:
                        continue
                    name_kh = (row.get("name_kh") or "").strip() or None
                    desc_kh = (row.get("description_kh") or "").strip() or None
                    treat_kh = (row.get("treatment_kh") or "").strip() or None
                    if disease.name_kh != name_kh:
                        disease.name_kh = name_kh
                        updated += 1
                    if disease.description_kh != desc_kh:
                        disease.description_kh = desc_kh
                        updated += 1
                    if disease.treatment_kh != treat_kh:
                        disease.treatment_kh = treat_kh
                        updated += 1
                db.session.commit()
                flash(f"Imported {updated} disease field(s).", "success")
                return redirect(url_for("admin.translations") + "#diseases")

            snapshot = {
                "scope": "symptoms",
                "items": [
                    {
                        "id": s.id,
                        "name_kh": s.name_kh,
                        "description_kh": s.description_kh,
                    }
                    for s in Symptom.query.order_by(Symptom.id.asc()).all()
                ],
            }
            _save_translation_backup("symptoms", snapshot)
            for row in reader:
                try:
                    symptom_id = int(row.get("id") or 0)
                except (TypeError, ValueError):
                    continue
                symptom = Symptom.query.get(symptom_id)
                if not symptom:
                    continue
                name_kh = (row.get("name_kh") or "").strip() or None
                desc_kh = (row.get("description_kh") or "").strip() or None
                if symptom.name_kh != name_kh:
                    symptom.name_kh = name_kh
                    updated += 1
                if symptom.description_kh != desc_kh:
                    symptom.description_kh = desc_kh
                    updated += 1
            db.session.commit()
            flash(f"Imported {updated} symptom field(s).", "success")
            return redirect(url_for("admin.translations") + "#symptoms")

        if action == "import_all":
            upload = request.files.get("file")
            if not upload:
                flash("Select a ZIP file to import.", "warning")
                return redirect(url_for("admin.translations"))
            try:
                data = upload.read()
                zf = zipfile.ZipFile(BytesIO(data))
            except Exception:
                flash("Unable to read ZIP file.", "danger")
                return redirect(url_for("admin.translations"))

            snapshot = {
                "scope": "all",
                "crops": [
                    {"id": c.id, "name_kh": c.name_kh, "description_kh": c.description_kh}
                    for c in Crop.query.order_by(Crop.id.asc()).all()
                ],
                "diseases": [
                    {
                        "id": d.id,
                        "name_kh": d.name_kh,
                        "description_kh": d.description_kh,
                        "treatment_kh": d.treatment_kh,
                    }
                    for d in Disease.query.order_by(Disease.id.asc()).all()
                ],
                "symptoms": [
                    {"id": s.id, "name_kh": s.name_kh, "description_kh": s.description_kh}
                    for s in Symptom.query.order_by(Symptom.id.asc()).all()
                ],
            }
            _save_translation_backup("all", snapshot)

            def _import_csv(content, section_name):
                nonlocal updated
                reader = csv.DictReader(StringIO(content))
                if not reader.fieldnames:
                    return
                if section_name == "crops":
                    for row in reader:
                        try:
                            crop_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        crop = Crop.query.get(crop_id)
                        if not crop:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        if crop.name_kh != name_kh:
                            crop.name_kh = name_kh
                            updated += 1
                        if crop.description_kh != desc_kh:
                            crop.description_kh = desc_kh
                            updated += 1
                elif section_name == "diseases":
                    for row in reader:
                        try:
                            disease_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        disease = Disease.query.get(disease_id)
                        if not disease:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        treat_kh = (row.get("treatment_kh") or "").strip() or None
                        if disease.name_kh != name_kh:
                            disease.name_kh = name_kh
                            updated += 1
                        if disease.description_kh != desc_kh:
                            disease.description_kh = desc_kh
                            updated += 1
                        if disease.treatment_kh != treat_kh:
                            disease.treatment_kh = treat_kh
                            updated += 1
                elif section_name == "symptoms":
                    for row in reader:
                        try:
                            symptom_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        symptom = Symptom.query.get(symptom_id)
                        if not symptom:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        if symptom.name_kh != name_kh:
                            symptom.name_kh = name_kh
                            updated += 1
                        if symptom.description_kh != desc_kh:
                            symptom.description_kh = desc_kh
                            updated += 1

            for filename in zf.namelist():
                name = filename.lower()
                if name.endswith(".csv"):
                    if "crops" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "crops")
                    elif "diseases" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "diseases")
                    elif "symptoms" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "symptoms")

            db.session.commit()
            flash(f"Imported {updated} field(s) from ZIP.", "success")
            return redirect(url_for("admin.translations"))

        if section == "crops":
            crops = _apply_filters(Crop.query, Crop.name, Crop.name_kh).order_by(Crop.name.asc()).all()
            for crop in crops:
                name_kh = (request.form.get(f"crop_name_kh_{crop.id}") or "").strip() or None
                desc_kh = (request.form.get(f"crop_desc_kh_{crop.id}") or "").strip() or None
                if crop.name_kh != name_kh:
                    crop.name_kh = name_kh
                    updated += 1
                if crop.description_kh != desc_kh:
                    crop.description_kh = desc_kh
                    updated += 1
            db.session.commit()
            flash(f"Updated {updated} crop field(s).", "success")
            return redirect(url_for("admin.translations", section="crops", q=q, missing=("1" if missing_only else "0")) + "#crops")

        if section == "diseases":
            diseases = _apply_filters(Disease.query, Disease.name, Disease.name_kh).order_by(Disease.name.asc()).all()
            for disease in diseases:
                name_kh = (request.form.get(f"disease_name_kh_{disease.id}") or "").strip() or None
                desc_kh = (request.form.get(f"disease_desc_kh_{disease.id}") or "").strip() or None
                treat_kh = (request.form.get(f"disease_treatment_kh_{disease.id}") or "").strip() or None
                if disease.name_kh != name_kh:
                    disease.name_kh = name_kh
                    updated += 1
                if disease.description_kh != desc_kh:
                    disease.description_kh = desc_kh
                    updated += 1
                if disease.treatment_kh != treat_kh:
                    disease.treatment_kh = treat_kh
                    updated += 1
            db.session.commit()
            flash(f"Updated {updated} disease field(s).", "success")
            return redirect(url_for("admin.translations", section="diseases", q=q, missing=("1" if missing_only else "0")) + "#diseases")

        if section == "symptoms":
            symptoms = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh).order_by(Symptom.name.asc()).all()
            for symptom in symptoms:
                name_kh = (request.form.get(f"symptom_name_kh_{symptom.id}") or "").strip() or None
                desc_kh = (request.form.get(f"symptom_desc_kh_{symptom.id}") or "").strip() or None
                if symptom.name_kh != name_kh:
                    symptom.name_kh = name_kh
                    updated += 1
                if symptom.description_kh != desc_kh:
                    symptom.description_kh = desc_kh
                    updated += 1
            db.session.commit()
            flash(f"Updated {updated} symptom field(s).", "success")
            return redirect(url_for("admin.translations", section="symptoms", q=q, missing=("1" if missing_only else "0")) + "#symptoms")

        flash("Select a valid section to update.", "warning")
        return redirect(url_for("admin.translations"))

    crops = _apply_filters(Crop.query, Crop.name, Crop.name_kh).order_by(Crop.name.asc()).all()
    diseases = _apply_filters(Disease.query, Disease.name, Disease.name_kh).order_by(Disease.name.asc()).all()
    symptoms = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh).order_by(Symptom.name.asc()).all()

    return render_template(
        "admin/translations.html",
        crops=crops,
        diseases=diseases,
        symptoms=symptoms,
        current_section=section,
        q=q,
        missing_only=missing_only
    )


@admin_bp.route("/translations/ai", methods=["POST"])
@login_required
@permission_required("manage_crops")
def translations_ai():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Invalid request"}), 400
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown")
    if _rate_limited(ip):
        return jsonify({"ok": False, "error": "Rate limit exceeded"}), 429
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if len(text) > 800:
        return jsonify({"ok": False, "error": "Text too long"}), 400
    if not text:
        return jsonify({"ok": False, "error": "No text provided"}), 400
    translated = translate_to_khmer(text)
    if not translated:
        return jsonify({"ok": False, "error": "Translation service unavailable"}), 503
    return jsonify({"ok": True, "translation": translated})


@admin_bp.route("/translations/backups", methods=["GET"])
@login_required
@permission_required("manage_crops")
def translations_backups():
    backups = (
        TranslationBackup.query
        .order_by(TranslationBackup.created_at.desc())
        .limit(30)
        .all()
    )
    return render_template(
        "admin/translations_backups.html",
        backups=backups
    )


@admin_bp.route("/translations/undo", methods=["POST"])
@login_required
@permission_required("manage_crops")
def translations_undo():
    backup_id = request.form.get("backup_id")
    if backup_id:
        backup = TranslationBackup.query.get(int(backup_id))
    else:
        backup = (
            TranslationBackup.query
            .order_by(TranslationBackup.created_at.desc())
            .first()
        )
    if not backup:
        flash("No backup found to restore.", "warning")
        return redirect(url_for("admin.translations"))
    try:
        payload = json.loads(backup.payload)
    except Exception:
        flash("Backup is corrupted.", "danger")
        return redirect(url_for("admin.translations"))

    scope = payload.get("scope") or backup.scope
    restored = 0

    if scope == "crops":
        for item in payload.get("items", []):
            crop = Crop.query.get(item.get("id"))
            if not crop:
                continue
            crop.name_kh = item.get("name_kh")
            crop.description_kh = item.get("description_kh")
            restored += 1

    elif scope == "diseases":
        for item in payload.get("items", []):
            disease = Disease.query.get(item.get("id"))
            if not disease:
                continue
            disease.name_kh = item.get("name_kh")
            disease.description_kh = item.get("description_kh")
            disease.treatment_kh = item.get("treatment_kh")
            restored += 1

    elif scope == "symptoms":
        for item in payload.get("items", []):
            symptom = Symptom.query.get(item.get("id"))
            if not symptom:
                continue
            symptom.name_kh = item.get("name_kh")
            symptom.description_kh = item.get("description_kh")
            restored += 1

    else:
        for item in payload.get("crops", []):
            crop = Crop.query.get(item.get("id"))
            if not crop:
                continue
            crop.name_kh = item.get("name_kh")
            crop.description_kh = item.get("description_kh")
            restored += 1
        for item in payload.get("diseases", []):
            disease = Disease.query.get(item.get("id"))
            if not disease:
                continue
            disease.name_kh = item.get("name_kh")
            disease.description_kh = item.get("description_kh")
            disease.treatment_kh = item.get("treatment_kh")
            restored += 1
        for item in payload.get("symptoms", []):
            symptom = Symptom.query.get(item.get("id"))
            if not symptom:
                continue
            symptom.name_kh = item.get("name_kh")
            symptom.description_kh = item.get("description_kh")
            restored += 1

    db.session.commit()
    flash(f"Restored {restored} item(s) from backup.", "success")
    return redirect(url_for("admin.translations"))



# ==================================================
# USER MANAGEMENT
# ==================================================
@admin_bp.route("/users")
@login_required
@permission_required("manage_users")
def users():
    q = (request.args.get("q") or "").strip()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like)
            )
        )
    return render_template(
        "admin/users.html",
        users=query.order_by(User.created_at.desc()).all(),
        roles=Role.query.all(),
        q=q
    )


# ==================================================
# BULK USER ACTIONS
# ==================================================
@admin_bp.route("/users/bulk", methods=["POST"])
@login_required
@permission_required("manage_users")
def users_bulk():
    action = (request.form.get("action") or "").strip().lower()
    scope = (request.form.get("scope") or "selected").strip().lower()
    q = (request.form.get("q") or "").strip()
    raw_ids = request.form.getlist("user_ids")
    user_ids = []
    for value in raw_ids:
        try:
            user_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    redirect_url = url_for("admin.users", q=q) if q else url_for("admin.users")

    if scope != "all" and not user_ids:
        flash("Select at least one user", "warning")
        return redirect(redirect_url)

    if action in ("export_csv", "export_json"):
        if scope == "all":
            query = User.query
            if q:
                like = f"%{q}%"
                query = query.filter(
                    or_(
                        User.username.ilike(like),
                        User.email.ilike(like),
                        User.full_name.ilike(like)
                    )
                )
            users = query.order_by(User.id.asc()).all()
        else:
            users = (
                User.query
                .filter(User.id.in_(user_ids))
                .order_by(User.id.asc())
                .all()
            )
        rows = [_user_row(user) for user in users]
        detail = (
            f"format={action.replace('export_', '')} scope={scope} "
            f"count={len(rows)} q={q or '-'}"
        )
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="USERS_EXPORT",
                detail=detail
            )
        )
        db.session.commit()
        filename_suffix = "all" if scope == "all" else "selected"
        if action == "export_json":
            payload = {
                "exported_at": datetime.utcnow().isoformat(),
                "users": rows
            }
            return _json_response(payload, f"users_{filename_suffix}.json")
        fieldnames = ["id", "username", "email", "roles", "is_active", "created_at"]
        return _csv_response(rows, fieldnames, f"users_{filename_suffix}.csv")

    if action not in ("ban", "unban"):
        flash("Select a bulk action", "danger")
        return redirect(redirect_url)

    if scope == "all":
        query = User.query
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    User.username.ilike(like),
                    User.email.ilike(like),
                    User.full_name.ilike(like)
                )
            )
        users = query.order_by(User.id.asc()).all()
    else:
        users = (
            User.query
            .filter(User.id.in_(user_ids))
            .order_by(User.id.asc())
            .all()
        )

    desired_active = action == "unban"
    updated = 0
    skipped = 0
    unchanged = 0

    for user in users:
        if user.has_role("admin"):
            skipped += 1
            continue
        if user.is_active == desired_active:
            unchanged += 1
            continue
        user.is_active = desired_active
        updated += 1
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="UNBAN_USER" if desired_active else "BAN_USER",
                target_user=user.username,
                detail="bulk=true"
            )
        )

    db.session.commit()
    verb = "Unbanned" if desired_active else "Banned"
    message = f"{verb} {updated} user(s)."
    if unchanged:
        message += f" {unchanged} already {('active' if desired_active else 'banned')}."
    if skipped:
        message += f" Skipped {skipped} admin user(s)."
    flash(message, "warning")
    return redirect(redirect_url)


# ==================================================
# USERS EXPORT (FILTERED)
# ==================================================
@admin_bp.route("/users/export")
@login_required
@permission_required("manage_users")
def users_export():
    export_format = (request.args.get("format") or "csv").strip().lower()
    q = (request.args.get("q") or "").strip()

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like)
            )
        )
    users = query.order_by(User.id.asc()).all()
    rows = [_user_row(user) for user in users]

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="USERS_EXPORT",
            detail=f"format={export_format} scope=all count={len(rows)} q={q or '-'}"
        )
    )
    db.session.commit()

    if export_format == "json":
        payload = {
            "exported_at": datetime.utcnow().isoformat(),
            "users": rows
        }
        return _json_response(payload, "users_filtered.json")
    if export_format == "csv":
        fieldnames = ["id", "username", "email", "roles", "is_active", "created_at"]
        return _csv_response(rows, fieldnames, "users_filtered.csv")

    abort(400)


# ==================================================
# CREATE USER
# ==================================================
@admin_bp.route("/users/create", methods=["POST"])
@login_required
@permission_required("manage_users")
def create_user():
    username = request.form.get("username")
    password = request.form.get("password")
    role_name = request.form.get("role")
    email_value = (request.form.get("email") or "").strip().lower()

    if not all([username, password, role_name]):
        flash("❌ All fields are required", "danger")
        return redirect(url_for("admin.users"))

    if User.query.filter_by(username=username).first():
        flash("❌ Username already exists", "danger")
        return redirect(url_for("admin.users"))

    if email_value and User.query.filter_by(email=email_value).first():
        flash("❌ Email already exists", "danger")
        return redirect(url_for("admin.users"))

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        flash("❌ Invalid role", "danger")
        return redirect(url_for("admin.users"))

    user = User(username=username)
    if email_value:
        user.email = email_value
    user.set_password(password)
    user.roles.append(role)

    db.session.add(user)
    db.session.flush()

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="CREATE_USER",
            target_user=username,
            detail=f"role={role_name}"
        )
    )

    db.session.commit()
    flash("✅ User created successfully", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# BAN / UNBAN USER
# ==================================================
@admin_bp.route("/users/<int:user_id>/toggle-status", methods=["POST"])
@login_required
@permission_required("manage_users")
def toggle_user_status(user_id):
    user = User.query.get_or_404(user_id)

    if user.has_role("admin"):
        flash("❌ Cannot modify admin account", "danger")
        return redirect(url_for("admin.users"))

    user.is_active = not user.is_active

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="UNBAN_USER" if user.is_active else "BAN_USER",
            target_user=user.username,
            detail=f"is_active={user.is_active}"
        )
    )

    db.session.commit()
    flash("⚠️ User status updated", "warning")
    return redirect(url_for("admin.users"))


# ==================================================
# CHANGE USER ROLE
# ==================================================
@admin_bp.route("/users/<int:user_id>/change-role", methods=["POST"])
@login_required
@permission_required("manage_users")
def change_user_role(user_id):
    user = User.query.get_or_404(user_id)
    new_role_name = request.form.get("role")

    role = Role.query.filter_by(name=new_role_name).first()
    if not role:
        flash("❌ Invalid role", "danger")
        return redirect(url_for("admin.users"))

    old_roles = [r.name for r in user.roles]

    user.roles.clear()
    user.roles.append(role)

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="CHANGE_ROLE",
            target_user=user.username,
            detail=f"{old_roles} → {new_role_name}"
        )
    )

    db.session.commit()
    flash("✅ Role updated", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# RESET USER PASSWORD
# ==================================================
@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@login_required
@permission_required("manage_users")
def reset_user_password(user_id):
    user = User.query.get_or_404(user_id)

    if user.has_role("admin"):
        flash("❌ Cannot change admin password here", "danger")
        return redirect(url_for("admin.users"))

    new_password = request.form.get("new_password", "").strip()
    if not new_password or len(new_password) < 6:
        flash("❌ Password must be at least 6 characters", "danger")
        return redirect(url_for("admin.users"))

    user.set_password(new_password)

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="RESET_PASSWORD",
            target_user=user.username,
            detail="admin_reset=true"
        )
    )

    db.session.commit()
    flash("✅ Password updated", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# UPDATE USER EMAIL
# ==================================================
@admin_bp.route("/users/<int:user_id>/update-email", methods=["POST"])
@login_required
@permission_required("manage_users")
def update_user_email(user_id):
    user = User.query.get_or_404(user_id)
    new_email = (request.form.get("email") or "").strip().lower()

    if new_email:
        existing = (
            User.query
            .filter(User.email == new_email, User.id != user.id)
            .first()
        )
        if existing:
            flash("❌ Email already exists", "danger")
            return redirect(url_for("admin.users"))
    else:
        new_email = None

    user.email = new_email

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="UPDATE_EMAIL",
            target_user=user.username,
            detail=f"email={new_email or 'cleared'}"
        )
    )

    db.session.commit()
    flash("✅ Email updated", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# ROLE LIST
# ==================================================
@admin_bp.route("/roles")
@login_required
@permission_required("manage_roles")
def roles():
    return render_template(
        "admin/roles.html",
        roles=Role.query.all()
    )


# ==================================================
# ROLE PERMISSIONS (PROTECTED)
# ==================================================
@admin_bp.route("/roles/<int:role_id>/permissions", methods=["GET", "POST"])
@login_required
@permission_required("manage_roles")
def manage_role_permissions(role_id):
    role = Role.query.get_or_404(role_id)
    permissions = Permission.query.all()

    if request.method == "POST":
        role.permissions.clear()

        for pid in request.form.getlist("permissions"):
            perm = Permission.query.get(int(pid))
            if perm:
                role.permissions.append(perm)

        # 🔐 FORCE CORE ADMIN PERMISSIONS
        if role.name == "admin":
            required = ["view_dashboard", "manage_users", "manage_roles"]
            for code in required:
                perm = Permission.query.filter_by(code=code).first()
                if perm and perm not in role.permissions:
                    role.permissions.append(perm)

        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="UPDATE_ROLE_PERMISSIONS",
                target_user=role.name
            )
        )

        db.session.commit()
        flash("✅ Permissions updated", "success")
        return redirect(url_for("admin.roles"))

    return render_template(
        "admin/manage_permissions.html",
        role=role,
        permissions=permissions
    )


# ==================================================
# 🔍 AUDIT LOGS
# ==================================================
@admin_bp.route("/audit-logs")
@login_required
@permission_required("view_dashboard")
def audit_logs():
    logs = (
        AuditLog.query
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )

    return render_template(
        "admin/audit_logs.html",
        logs=logs
    )
