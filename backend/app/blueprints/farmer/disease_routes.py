from flask import Blueprint, render_template
from flask_login import login_required
from app.models.crop import Crop

farmer_disease_bp = Blueprint(
    "farmer_disease",
    __name__,
    url_prefix="/farmer/diseases"
)


@farmer_disease_bp.route("/")
@login_required
def index():
    crops = Crop.query.all()
    return render_template(
        "farmer/diseases/index.html",
        crops=crops
    )
