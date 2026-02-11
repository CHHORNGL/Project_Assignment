from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from app.utils.decorators import role_required
from app.extensions import db
from app.models.disease import Disease
from app.models.crop import Crop

expert_disease_bp = Blueprint(
    "expert_disease",
    __name__,
    url_prefix="/expert/diseases"
)


@expert_disease_bp.route("/")
@login_required
@role_required("expert")
def index():
    diseases = Disease.query.all()
    return render_template("expert/diseases/index.html", diseases=diseases)


@expert_disease_bp.route("/create", methods=["GET", "POST"])
@login_required
@role_required("expert")
def create():
    crops = Crop.query.all()

    if request.method == "POST":
        disease = Disease(
            name=request.form["name"],
            crop_id=request.form["crop_id"],
            description=request.form["description"],
            severity_level=request.form["severity_level"]
        )
        db.session.add(disease)
        db.session.commit()

        flash("Disease added.", "success")
        return redirect(url_for("expert_disease.index"))

    return render_template(
        "expert/diseases/create.html",
        crops=crops
    )
