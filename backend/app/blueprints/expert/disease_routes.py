from flask import Blueprint, request, redirect, url_for, flash
from flask_login import login_required
from app.utils.decorators import role_required
from app.utils.react_bootstrap import (
    build_expert_disease_form_bootstrap,
    build_expert_diseases_bootstrap,
    render_react_page,
)
from app.blueprints.expert.routes import REFERENCE_SCOPE_OPTIONS
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
    knowledge_ready_count = sum(
        1
        for disease in diseases
        if (disease.cause_explanation or disease.treatment or disease.prevention_tips or disease.reference_links)
    )
    return render_react_page(
        bootstrap_payload=build_expert_diseases_bootstrap(
            diseases=diseases,
            knowledge_ready_count=knowledge_ready_count,
            reference_scope_labels={item["id"]: item["label"] for item in REFERENCE_SCOPE_OPTIONS},
        ),
        title="Diagnosis Knowledge Manager",
    )


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

    payload = build_expert_disease_form_bootstrap(
        crops=crops,
        back_url=url_for("expert_disease.index"),
    )
    payload["data"]["minimalMode"] = True
    return render_react_page(
        bootstrap_payload=payload,
        title="Add Disease",
    )
