# app/blueprints/expert/__init__.py

from flask import Blueprint

expert_bp = Blueprint(
    "expert",
    __name__,
    url_prefix="/expert",
    template_folder="../../templates/expert"
)

from . import routes
from . import knowledge
