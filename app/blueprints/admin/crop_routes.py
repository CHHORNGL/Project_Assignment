from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.utils.decorators import permission_required
from app.extensions import db
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.expert_question import ExpertQuestion

admin_crop_bp = Blueprint(
    "admin_crop",
    __name__,
    url_prefix="/admin/crops"
)


@admin_crop_bp.route("/")
@login_required
@permission_required("manage_crops")
def index():
    crops = Crop.query.all()
    return render_template("admin/crops.html", crops=crops)


@admin_crop_bp.route("/create", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def create():
    if request.method == "POST":
        name = request.form.get("name")
        name_kh = request.form.get("name_kh")
        emoji = (request.form.get("emoji") or "").strip()[:8] or None
        description = request.form.get("description")
        description_kh = request.form.get("description_kh")

        if not name:
            flash("Crop name is required.", "danger")
            return redirect(request.url)

        crop = Crop(
            name=name,
            name_kh=name_kh,
            emoji=emoji,
            description=description,
            description_kh=description_kh
        )
        db.session.add(crop)
        db.session.commit()

        flash("Crop added successfully.", "success")
        return redirect(url_for("admin_crop.index"))

    return render_template("admin/create_crop.html")


@admin_crop_bp.route("/<int:id>/edit", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def edit(id):
    crop = Crop.query.get_or_404(id)
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        if not name:
            flash("Crop name is required.", "danger")
            return redirect(request.url)
        crop.name = name
        crop.name_kh = request.form.get("name_kh", "").strip() or None
        crop.emoji = (request.form.get("emoji") or "").strip()[:8] or None
        crop.description = request.form.get("description", "").strip() or None
        crop.description_kh = request.form.get("description_kh", "").strip() or None
        db.session.commit()
        flash("Crop updated successfully.", "success")
        return redirect(url_for("admin_crop.index"))
    return render_template("admin/edit_crop.html", crop=crop)


@admin_crop_bp.route("/<int:id>/delete", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def delete(id):
    crop = Crop.query.get_or_404(id)
    try:
        # Detach references in diagnoses and expert questions to preserve farmer history
        disease_ids = [d.id for d in crop.diseases]
        if disease_ids:
            Diagnosis.query.filter(Diagnosis.disease_id.in_(disease_ids)).update(
                {Diagnosis.disease_id: None}, synchronize_session=False
            )
        Diagnosis.query.filter_by(crop_id=crop.id).update(
            {Diagnosis.crop_id: None}, synchronize_session=False
        )
        ExpertQuestion.query.filter_by(crop_id=crop.id).update(
            {ExpertQuestion.crop_id: None}, synchronize_session=False
        )

        db.session.delete(crop)
        db.session.commit()
        flash("Crop deleted.", "warning")
    except Exception as e:
        db.session.rollback()
        flash(f"Failed to delete crop: {str(e)}", "danger")

    return redirect(url_for("admin_crop.index"))


@admin_crop_bp.route("/bulk", methods=["POST"])
@login_required
@permission_required("manage_crops")
def bulk():
    action = request.form.get("action")
    scope = request.form.get("scope", "selected")

    if action != "delete":
        flash("Select a bulk action", "danger")
        return redirect(url_for("admin_crop.index"))

    if scope == "all":
        crops = Crop.query.all()
    else:
        crop_ids = request.form.getlist("crop_ids")
        if not crop_ids:
            flash("Select at least one crop", "warning")
            return redirect(url_for("admin_crop.index"))
        crops = Crop.query.filter(Crop.id.in_(crop_ids)).all()

    if not crops:
        flash("No crops found to delete", "warning")
        return redirect(url_for("admin_crop.index"))

    try:
        target_crop_ids = [c.id for c in crops]
        all_disease_ids = [d.id for c in crops for d in c.diseases]
        if all_disease_ids:
            Diagnosis.query.filter(Diagnosis.disease_id.in_(all_disease_ids)).update(
                {Diagnosis.disease_id: None}, synchronize_session=False
            )
        Diagnosis.query.filter(Diagnosis.crop_id.in_(target_crop_ids)).update(
            {Diagnosis.crop_id: None}, synchronize_session=False
        )
        ExpertQuestion.query.filter(ExpertQuestion.crop_id.in_(target_crop_ids)).update(
            {ExpertQuestion.crop_id: None}, synchronize_session=False
        )

        for crop in crops:
            db.session.delete(crop)
        db.session.commit()
        flash(f"Deleted {len(crops)} crop(s)", "warning")
    except Exception as e:
        db.session.rollback()
        flash(f"Failed to delete crops: {str(e)}", "danger")

    return redirect(url_for("admin_crop.index"))
