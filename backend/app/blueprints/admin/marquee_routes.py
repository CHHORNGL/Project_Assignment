from flask import request, redirect, url_for, flash
from app.utils.react_bootstrap import (
    build_admin_marquee_form_bootstrap,
    build_admin_marquees_bootstrap,
    render_react_page,
)
from app.extensions import db
from app.models import Marquee
from .routes import admin_bp
from app.utils.decorators import admin_required

def _apply_marquee_form(marquee: Marquee, form_data) -> tuple[bool, str | None]:
    text = (form_data.get("text") or "").strip()
    if not text:
        return False, "Text (English) is required."

    text_kh = (form_data.get("text_kh") or "").strip() or None
    try:
        sort_order = int(form_data.get("sort_order") or 0)
    except (TypeError, ValueError):
        sort_order = 0

    marquee.text = text
    marquee.text_kh = text_kh
    marquee.sort_order = sort_order
    marquee.is_active = "is_active" in form_data
    return True, None


@admin_bp.route("/marquees")
@admin_required
def marquees():
    marquees_list = Marquee.query.order_by(Marquee.sort_order.asc(), Marquee.id.desc()).all()
    return render_react_page(
        bootstrap_payload=build_admin_marquees_bootstrap(marquees=marquees_list),
        title="Marquee Announcements",
    )


@admin_bp.route("/marquees/add", methods=["GET", "POST"])
@admin_required
def add_marquee():
    if request.method == "POST":
        new_marquee = Marquee()
        ok, err = _apply_marquee_form(new_marquee, request.form)
        if not ok:
            flash(err or "Text (English) is required.", "danger")
            return redirect(request.url)

        db.session.add(new_marquee)
        db.session.commit()
        flash("Marquee added successfully.", "success")
        return redirect(url_for("admin.marquees"))

    return render_react_page(
        bootstrap_payload=build_admin_marquee_form_bootstrap(marquee=None),
        title="New Marquee",
    )


@admin_bp.route("/marquees/edit/<int:marquee_id>", methods=["GET", "POST"])
@admin_required
def edit_marquee(marquee_id):
    marquee = Marquee.query.get_or_404(marquee_id)
    if request.method == "POST":
        ok, err = _apply_marquee_form(marquee, request.form)
        if not ok:
            flash(err or "Text (English) is required.", "danger")
            return redirect(request.url)

        db.session.commit()
        flash("Marquee updated successfully.", "success")
        return redirect(url_for("admin.marquees"))

    return render_react_page(
        bootstrap_payload=build_admin_marquee_form_bootstrap(marquee=marquee),
        title="Edit Marquee",
    )


@admin_bp.route("/marquees/toggle/<int:marquee_id>", methods=["POST"])
@admin_required
def toggle_marquee(marquee_id):
    marquee = Marquee.query.get_or_404(marquee_id)
    marquee.is_active = not bool(marquee.is_active)
    db.session.commit()
    flash("Marquee activated." if marquee.is_active else "Marquee paused.", "success")
    return redirect(url_for("admin.marquees"))


@admin_bp.route("/marquees/delete/<int:marquee_id>", methods=["POST"])
@admin_required
def delete_marquee(marquee_id):
    marquee = Marquee.query.get_or_404(marquee_id)
    db.session.delete(marquee)
    db.session.commit()
    flash("Marquee deleted successfully.", "success")
    return redirect(url_for("admin.marquees"))
