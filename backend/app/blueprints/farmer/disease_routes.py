from flask import Blueprint
from flask_login import login_required
from app.models.crop import Crop
from app.models.disease import Disease
from app.utils.react_bootstrap import build_farmer_diseases_bootstrap, render_react_page

farmer_disease_bp = Blueprint(
    "farmer_disease",
    __name__,
    url_prefix="/farmer/diseases"
)


@farmer_disease_bp.route("/")
@login_required
def index():
    crops = Crop.query.all()
    diseases = Disease.query.all()
    return render_react_page(
        bootstrap_payload=build_farmer_diseases_bootstrap(crops=crops, diseases=diseases),
        title="Crop & Disease Atlas",
    )
