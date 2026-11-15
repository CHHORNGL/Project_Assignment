from flask import render_template, request, redirect, url_for, flash
from app.extensions import db
from app.models import Marquee
from .routes import admin_bp
from app.utils.decorators import admin_required

@admin_bp.route("/marquees")
@admin_required
def marquees():
    marquees_list = Marquee.query.order_by(Marquee.sort_order).all()
    return render_template("admin/marquees.html", marquees=marquees_list)

@admin_bp.route("/marquees/add", methods=["GET", "POST"])
@admin_required
def add_marquee():
    if request.method == "POST":
        text = request.form.get("text")
        text_kh = request.form.get("text_kh")
        sort_order = request.form.get("sort_order", type=int, default=0)
        is_active = 'is_active' in request.form
        
        if not text:
            flash("Text (English) is required.", "danger")
            return redirect(request.url)
            
        new_marquee = Marquee(
            text=text,
            text_kh=text_kh,
            sort_order=sort_order,
            is_active=is_active
        )
        db.session.add(new_marquee)
        db.session.commit()
        flash("Marquee added successfully.", "success")
        return redirect(url_for("admin.marquees"))
            
    return render_template("admin/marquee_form.html", marquee=None)

@admin_bp.route("/marquees/edit/<int:marquee_id>", methods=["GET", "POST"])
@admin_required
def edit_marquee(marquee_id):
    marquee = Marquee.query.get_or_404(marquee_id)
    if request.method == "POST":
        marquee.text = request.form.get("text")
        marquee.text_kh = request.form.get("text_kh")
        marquee.sort_order = request.form.get("sort_order", type=int, default=0)
        marquee.is_active = 'is_active' in request.form
        
        if not marquee.text:
            flash("Text (English) is required.", "danger")
            return redirect(request.url)
            
        db.session.commit()
        flash("Marquee updated successfully.", "success")
        return redirect(url_for("admin.marquees"))
        
    return render_template("admin/marquee_form.html", marquee=marquee)

@admin_bp.route("/marquees/delete/<int:marquee_id>", methods=["POST"])
@admin_required
def delete_marquee(marquee_id):
    marquee = Marquee.query.get_or_404(marquee_id)
    db.session.delete(marquee)
    db.session.commit()
    flash("Marquee deleted successfully.", "success")
    return redirect(url_for("admin.marquees"))
