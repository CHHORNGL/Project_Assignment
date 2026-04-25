from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.utils.decorators import permission_required
from app.extensions import db
from app.models.crop import Crop

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


@admin_crop_bp.route("/<int:id>/delete")
@login_required
@permission_required("manage_crops")
def delete(id):
    crop = Crop.query.get_or_404(id)
    db.session.delete(crop)
    db.session.commit()

    flash("Crop deleted.", "warning")
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

    for crop in crops:
        db.session.delete(crop)
    db.session.commit()

    flash(f"Deleted {len(crops)} crop(s)", "warning")
    return redirect(url_for("admin_crop.index"))
