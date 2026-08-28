from flask import Blueprint
from .routes import admin_bp

admin_bp = Blueprint(
    "admin",
    __name__,
    template_folder="../../templates/admin"
)

from . import routes
from . import support_chat
from .marquee_routes import *
