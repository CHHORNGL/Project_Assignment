# app/blueprints/admin/routes.py

import csv
import json
import os
import random
import re
import secrets
import string
import threading
import time
import zipfile
from datetime import datetime, timedelta, timezone
from functools import wraps
from io import BytesIO, StringIO

from flask import (
    Blueprint,
    Response,
    abort,
    current_app,
    flash,
    jsonify,
    redirect,
    request,
    url_for,
)
from app.utils.react_bootstrap import (
    build_admin_audit_logs_bootstrap,
    build_admin_dashboard_bootstrap,
    build_admin_disease_form_bootstrap,
    build_admin_diseases_bootstrap,
    build_admin_expert_stats_bootstrap,
    build_admin_premium_settings_bootstrap,
    build_admin_promo_codes_bootstrap,
    build_admin_role_permissions_bootstrap,
    build_admin_roles_bootstrap,
    build_admin_settings_bootstrap,
    build_admin_settings_ssr_html,
    build_admin_support_requests_bootstrap,
    build_admin_translations_backups_bootstrap,
    build_admin_translations_bootstrap,
    build_admin_user_detail_bootstrap,
    build_admin_users_bootstrap,
    build_admin_world_bootstrap,
    render_react_page,
)
from flask_login import current_user, login_required
from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.associations import user_roles
from app.models.audit_log import AuditLog
from app.models.chat_message import ChatMessage
from app.models.crop import Crop
from app.models.diagnosis import Diagnosis
from app.models.disease import Disease
from app.models.payment_transaction import PaymentTransaction
from app.models.permission import Permission
from app.models.premium_coupon import PremiumCoupon
from app.models.promo import PromoCode
from app.models.role import Role
from app.models.site_setting import SiteSetting
from app.models.support_request import SupportRequest
from app.models.symptom import Symptom
from app.models.translation_backup import TranslationBackup
from app.models.user import User
from app.services.ai_expert_service import is_valid_inference_endpoint, request_endpoint
from app.services.bakong_service import get_bakong_config, get_khqr_client
from app.services.notification_service import _snippet, notify_user
from app.services.translator import translate_to_khmer
from app.utils.audit import get_client_ip
from app.utils.decorators import admin_required, permission_required
from app.utils.i18n import t


def _now_dt() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/admin"
)

CORE_ROLE_NAMES = ("admin", "expert", "farmer")


def _user_row(user):
    roles = ", ".join(sorted({role.name for role in user.roles})) if user.roles else ""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": roles,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _csv_response(rows, fieldnames, filename):
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: "" if v is None else v for k, v in row.items()})
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _json_response(payload, filename):
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    return Response(
        content,
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def _zip_response(files, filename):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    buffer.seek(0)
    return Response(
        buffer.getvalue(),
        mimetype="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================================================
# ADMIN DASHBOARD
# ==================================================
@admin_bp.route("/premium-settings", methods=["GET", "POST"])
@login_required
@admin_required
def premium_settings():
    def get_or_set_setting(key, value=None):
        setting = SiteSetting.query.get(key)
        if value is not None:
            if not setting:
                setting = SiteSetting(key=key, value=str(value))
                db.session.add(setting)
            else:
                setting.value = str(value)
        return setting.value if setting else ""

    if request.method == "POST":
        action = request.form.get("action", "save_pricing")

        if action == "save_pricing":
            new_price = request.form.get("premium_price", "20.00").strip()
            yearly_discount_percent = request.form.get("yearly_discount_percent", "20").strip()
            discount_percent = request.form.get("discount_percent", "0").strip()
            discount_banner = request.form.get("discount_banner", "").strip()
            coupon_enabled = "1" if request.form.get("coupon_enabled") else "0"
            simple_user_daily_tokens = request.form.get("simple_user_daily_tokens", "13000").strip()

            get_or_set_setting("premium_price", new_price)
            get_or_set_setting("premium_yearly_discount_percent", yearly_discount_percent)
            get_or_set_setting("premium_discount_percent", discount_percent)
            get_or_set_setting("premium_discount_banner", discount_banner)
            get_or_set_setting("premium_coupon_enabled", coupon_enabled)
            get_or_set_setting("SIMPLE_USER_DAILY_TOKENS", simple_user_daily_tokens)

            db.session.commit()
            flash("Pricing, token quotas, and discount settings updated successfully.", "success")
            return redirect(url_for("admin.premium_settings"))

        elif action == "create_coupon":
            code = request.form.get("code", "").strip().upper()
            discount_type = request.form.get("discount_type", "percent")
            if discount_type not in {"percent", "fixed"}:
                discount_type = "percent"
            try:
                discount_value = max(0.0, float(request.form.get("discount_value", 10.0) or 0.0))
            except (TypeError, ValueError):
                flash("Invalid discount value.", "danger")
                return redirect(url_for("admin.premium_settings"))
            try:
                max_uses = max(1, int(request.form.get("max_uses", 100) or 100))
            except (TypeError, ValueError):
                flash("Invalid max uses value.", "danger")
                return redirect(url_for("admin.premium_settings"))
            expiry_str = request.form.get("expires_at", "").strip()
            
            expires_at = None
            if expiry_str:
                try:
                    expires_at = datetime.strptime(expiry_str, "%Y-%m-%d").replace(tzinfo=timezone.utc).replace(tzinfo=None)
                except ValueError:
                    expires_at = None

            if not code:
                flash("Coupon code cannot be empty.", "danger")
            elif PremiumCoupon.query.filter_by(code=code).first():
                flash(f"Coupon code '{code}' already exists.", "warning")
            else:
                new_coupon = PremiumCoupon(
                    code=code,
                    discount_type=discount_type,
                    discount_value=discount_value,
                    max_uses=max_uses,
                    expires_at=expires_at,
                    is_active=True
                )
                db.session.add(new_coupon)
                db.session.commit()
                flash(f"Coupon '{code}' created successfully!", "success")
            return redirect(url_for("admin.premium_settings"))

        elif action == "toggle_coupon":
            coupon_id = request.form.get("coupon_id")
            coupon = PremiumCoupon.query.get(coupon_id)
            if coupon:
                coupon.is_active = not coupon.is_active
                db.session.commit()
                status = "activated" if coupon.is_active else "deactivated"
                flash(f"Coupon '{coupon.code}' {status}.", "info")
            return redirect(url_for("admin.premium_settings"))

        elif action == "delete_coupon":
            coupon_id = request.form.get("coupon_id")
            coupon = PremiumCoupon.query.get(coupon_id)
            if coupon:
                code_name = coupon.code
                db.session.delete(coupon)
                db.session.commit()
                flash(f"Coupon '{code_name}' deleted.", "success")
            return redirect(url_for("admin.premium_settings"))

        elif action == "save_bakong":
            bakong_token = request.form.get("bakong_token", "").strip()
            bakong_account_id = request.form.get("bakong_account_id", "").strip()
            bakong_merchant_name = request.form.get("bakong_merchant_name", "").strip()
            bakong_merchant_city = request.form.get("bakong_merchant_city", "").strip()
            bakong_currency = request.form.get("bakong_currency", "USD").strip().upper()
            bakong_store_label = request.form.get("bakong_store_label", "").strip()

            if bakong_token:
                get_or_set_setting("bakong_token", bakong_token)
            if bakong_account_id:
                get_or_set_setting("bakong_account_id", bakong_account_id)
            if bakong_merchant_name:
                get_or_set_setting("bakong_merchant_name", bakong_merchant_name)
            if bakong_merchant_city:
                get_or_set_setting("bakong_merchant_city", bakong_merchant_city)
            if bakong_currency:
                get_or_set_setting("bakong_currency", bakong_currency)
            if bakong_store_label:
                get_or_set_setting("bakong_store_label", bakong_store_label)

            db.session.commit()
            flash("Bakong KHQR gateway configuration updated successfully.", "success")
            return redirect(url_for("admin.premium_settings"))

    # Fetch current settings
    current_price = get_or_set_setting("premium_price") or "20.00"
    yearly_discount_percent = get_or_set_setting("premium_yearly_discount_percent") or "20"
    discount_percent = get_or_set_setting("premium_discount_percent") or "0"
    discount_banner = get_or_set_setting("premium_discount_banner") or ""
    coupon_enabled = get_or_set_setting("premium_coupon_enabled") != "0"
    simple_user_daily_tokens = get_or_set_setting("SIMPLE_USER_DAILY_TOKENS") or "13000"

    try:
        orig = float(current_price)
        disc = float(discount_percent)
        final_price = f"{max(0.0, orig * (1.0 - disc / 100.0)):.2f}"
    except (ValueError, TypeError):
        final_price = current_price

    try:
        ydisc = float(yearly_discount_percent)
        monthly_val = float(final_price)
        yearly_final_monthly_rate = f"{monthly_val * (1.0 - ydisc / 100.0):.2f}"
        yearly_total_amount = f"{float(yearly_final_monthly_rate) * 12:.2f}"
    except (ValueError, TypeError):
        yearly_final_monthly_rate = "16.00"
        yearly_total_amount = "192.00"

    coupons = PremiumCoupon.query.order_by(PremiumCoupon.created_at.desc()).all()
    premium_users_count = User.query.filter_by(is_premium=True).count()

    bakong_config = get_bakong_config()
    recent_transactions = PaymentTransaction.query.order_by(PaymentTransaction.created_at.desc()).limit(30).all()
    tx_stats = {
        "paidCount": PaymentTransaction.query.filter_by(status="PAID").count(),
        "pendingCount": PaymentTransaction.query.filter_by(status="PENDING").count(),
        "totalRevenueUsd": float(
            db.session.query(func.coalesce(func.sum(PaymentTransaction.amount), 0.0))
            .filter(PaymentTransaction.status == "PAID", PaymentTransaction.currency == "USD")
            .scalar()
            or 0.0
        ),
    }

    return render_react_page(
        bootstrap_payload=build_admin_premium_settings_bootstrap(
            current_price=current_price,
            yearly_discount_percent=yearly_discount_percent,
            yearly_final_monthly_rate=yearly_final_monthly_rate,
            yearly_total_amount=yearly_total_amount,
            discount_percent=discount_percent,
            discount_banner=discount_banner,
            coupon_enabled=coupon_enabled,
            simple_user_daily_tokens=simple_user_daily_tokens,
            final_price=final_price,
            coupons=coupons,
            premium_count=premium_users_count,
            bakong_config=bakong_config,
            recent_transactions=recent_transactions,
            tx_stats=tx_stats,
        ),
        title="Premium & Pricing Settings",
    )

@admin_bp.route("/api/bakong/test-connection", methods=["GET", "POST"])
@login_required
@admin_required
def test_bakong_connection():
    try:
        cfg = get_bakong_config()
        client = get_khqr_client()
        test_res = client.create_qr(
            amount=1.00,
            account_id=cfg["account_id"],
            merchant_name=cfg["merchant_name"],
            merchant_city=cfg["merchant_city"],
            currency="USD",
            bill_number="CONNTEST"
        )
        check = client.check_payment(test_res.md5)
        return jsonify({
            "success": True,
            "message": f"Connected to Bakong NBC! Account: {cfg['account_id']} | Live status check response: {check}",
            "md5": test_res.md5
        })
    except Exception as e:  # noqa: BLE001
        return jsonify({
            "success": False,
            "message": f"Bakong test failed: {e!s}"
        }), 400


@admin_bp.route("/premium-settings/approve-transaction/<int:tx_id>", methods=["POST"])
@login_required
@admin_required
def approve_bakong_transaction(tx_id):
    from app.services.bakong_service import approve_khqr_transaction_manually
    res = approve_khqr_transaction_manually(tx_id, current_user)
    if res.get("success"):
        flash(res.get("message", "Transaction approved!"), "success")
    else:
        flash(res.get("message", "Failed to approve transaction."), "danger")
    return redirect(url_for("admin.premium_settings"))


@admin_bp.route("/premium-settings/check-transaction/<int:tx_id>", methods=["POST"])
@login_required
@admin_required
def check_bakong_transaction(tx_id):
    from app.services.bakong_service import verify_khqr_payment
    tx = PaymentTransaction.query.get_or_404(tx_id)
    if not tx.md5:
        flash(f"Transaction #{tx_id} has no MD5 hash.", "warning")
        return redirect(url_for("admin.premium_settings"))
    res = verify_khqr_payment(tx.md5, enforce_expiry=False, bypass_cache=True)
    if res.get("status") == "PAID":
        flash(f"Transaction #{tx_id} verified as PAID! VIP activated.", "success")
    elif res.get("status") == "RATE_LIMITED":
        flash(f"Bakong API is rate-limited: {res.get('message')}", "warning")
    else:
        flash(f"Bakong API status for #{tx_id}: {res.get('status', 'UNPAID')}", "info")
    return redirect(url_for("admin.premium_settings"))


def _get_server_location_defaults() -> tuple[str, str, str]:
    """Return configured server monitoring location name, latitude, and longitude strings."""
    loc_name_setting = SiteSetting.query.get("SERVER_LOCATION_NAME")
    loc_lat_setting = SiteSetting.query.get("SERVER_LOCATION_LAT")
    loc_lon_setting = SiteSetting.query.get("SERVER_LOCATION_LON")
    return (
        loc_name_setting.value.strip() if loc_name_setting and loc_name_setting.value else "Phnom Penh, Cambodia",
        loc_lat_setting.value.strip() if loc_lat_setting and loc_lat_setting.value else "11.5564",
        loc_lon_setting.value.strip() if loc_lon_setting and loc_lon_setting.value else "104.9282",
    )


def _safe_float(raw: str, default: float) -> float:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return default


@admin_bp.route("/dashboard")
@admin_required
def dashboard():
    total_users = User.query.count()
    total_diagnoses = Diagnosis.query.count()
    pending_diagnoses = Diagnosis.query.filter_by(status="PENDING").count()
    total_chats = db.session.query(func.count(ChatMessage.session_id.distinct())).scalar() or 0
    recent_logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(10).all()
    location_name, location_lat_str, location_lon_str = _get_server_location_defaults()
    return render_react_page(
        bootstrap_payload=build_admin_dashboard_bootstrap(
            total_users=total_users,
            total_diagnoses=total_diagnoses,
            pending_diagnoses=pending_diagnoses,
            total_chats=total_chats,
            recent_logs=recent_logs,
            scan_points=[],
            cesium_token=os.getenv("CESIUM_TOKEN", ""),
            location_name=location_name,
            location_lat=_safe_float(location_lat_str, 11.5564),
            location_lon=_safe_float(location_lon_str, 104.9282),
        ),
        title="Admin Control Center",
    )


# ==================================================
# GLOBAL WEATHER & ATMOSPHERIC MAP
# ==================================================
GLOBAL_WEATHER_HUBS = [
    ("Bangkok, Thailand", "Southeast Asia", 13.7563, 100.5018),
    ("Ho Chi Minh City, Vietnam", "Southeast Asia", 10.8231, 106.6297),
    ("Singapore", "Equatorial Tropics", 1.3521, 103.8198),
    ("Tokyo, Japan", "East Asia", 35.6762, 139.6503),
    ("Dubai, UAE", "Arid Subtropical", 25.2048, 55.2708),
    ("London, UK", "North Atlantic", 51.5072, -0.1276),
    ("New York, USA", "North America", 40.7128, -74.0060),
    ("Reykjavik, Iceland", "Subpolar North", 64.1466, -21.9426),
]

CAMBODIA_WEATHER_HUBS = [
    "Phnom Penh",
    "Siem Reap",
    "Battambang",
    "Kampong Cham",
    "Kampot",
    "Preah Sihanouk",
    "Mondulkiri",
    "Stung Treng",
    "Takeo",
]


@admin_bp.route("/world")
@admin_required
def world():
    from app.blueprints.farmer.support_chat import CAMBODIA_PROVINCES

    location_name, location_lat_str, location_lon_str = _get_server_location_defaults()
    featured = set(CAMBODIA_WEATHER_HUBS)
    scan_points = [
        {
            "id": f"kh-{name.lower().replace(' ', '-')}",
            "label": name,
            "region": "Cambodia",
            "group": "cambodia",
            "lat": p_lat,
            "lng": p_lon,
            "status": "live",
        }
        for name, p_lat, p_lon in CAMBODIA_PROVINCES
        if name in featured
    ] + [
        {
            "id": f"global-{name.lower().split(',')[0].replace(' ', '-')}",
            "label": name,
            "region": region,
            "group": "global",
            "lat": g_lat,
            "lng": g_lon,
            "status": "live",
        }
        for name, region, g_lat, g_lon in GLOBAL_WEATHER_HUBS
    ]

    return render_react_page(
        bootstrap_payload=build_admin_world_bootstrap(
            scan_points=scan_points,
            cesium_token=os.getenv("CESIUM_TOKEN", ""),
            default_center={
                "lat": _safe_float(location_lat_str, 11.5564),
                "lng": _safe_float(location_lon_str, 104.9282),
                "label": location_name,
            },
            weather_api_url=url_for("admin.world_weather"),
        ),
        title="Global Weather Map",
    )


@admin_bp.route("/world/weather", methods=["GET"])
@admin_required
def world_weather():
    from app.blueprints.weather_intelligence.routes import build_weather_summary_response

    return build_weather_summary_response()


# ==================================================
# 📊 EXPERT STATISTICS
# ==================================================
def _confidence_to_pct(value) -> float | None:
    if value is None:
        return None
    num = float(value)
    return round(num * 100.0 if num <= 1.0 else num, 1)


def _confidence_pct_expr():
    return case(
        (Diagnosis.confidence <= 1.0, Diagnosis.confidence * 100.0),
        else_=Diagnosis.confidence,
    )


@admin_bp.route("/expert-statistics")
@login_required
@permission_required("view_reports")
def expert_statistics():
    total = Diagnosis.query.count()

    raw_status_counts = (
        db.session.query(Diagnosis.status, func.count(Diagnosis.id))
        .group_by(Diagnosis.status)
        .all()
    )
    status_counts: dict[str, int] = {}
    for raw_status, cnt in raw_status_counts:
        key = str(raw_status or "UNKNOWN").strip().upper()
        status_counts[key] = status_counts.get(key, 0) + int(cnt or 0)

    pending = status_counts.get("PENDING", 0)
    resolved_total = max(0, total - pending)

    avg_conf_val = (
        db.session.query(func.avg(_confidence_pct_expr()))
        .filter(Diagnosis.confidence.isnot(None))
        .scalar()
    )
    avg_confidence = round(float(avg_conf_val), 1) if avg_conf_val is not None else None

    raw_feedback = (
        db.session.query(Diagnosis.feedback_rating, func.count(Diagnosis.id))
        .filter(Diagnosis.feedback_rating.isnot(None))
        .group_by(Diagnosis.feedback_rating)
        .all()
    )
    feedback_counts: dict[str, int] = {}
    for rating, cnt in raw_feedback:
        key = str(rating or "").strip().lower()
        if key:
            feedback_counts[key] = feedback_counts.get(key, 0) + int(cnt or 0)

    crop_rows = (
        db.session.query(
            Diagnosis.crop_name,
            func.count(Diagnosis.id).label("cnt"),
            func.avg(_confidence_pct_expr()).label("avg_conf"),
        )
        .group_by(Diagnosis.crop_name)
        .order_by(func.count(Diagnosis.id).desc(), Diagnosis.crop_name.asc())
        .limit(8)
        .all()
    )
    crop_breakdown = [
        {
            "cropName": str(crop_name or "Unknown"),
            "count": int(cnt or 0),
            "avgConfidence": round(float(avg_conf), 1) if avg_conf is not None else None,
        }
        for crop_name, cnt, avg_conf in crop_rows
    ]

    disease_rows = (
        db.session.query(
            Diagnosis.disease_name,
            func.max(Diagnosis.crop_name).label("crop_name"),
            func.count(Diagnosis.id).label("cnt"),
        )
        .group_by(Diagnosis.disease_name)
        .order_by(func.count(Diagnosis.id).desc(), Diagnosis.disease_name.asc())
        .limit(8)
        .all()
    )
    disease_breakdown = [
        {
            "diseaseName": str(disease_name or "Unknown"),
            "cropName": str(crop_name or ""),
            "count": int(cnt or 0),
        }
        for disease_name, crop_name, cnt in disease_rows
    ]

    reviewer_rows = (
        db.session.query(
            User.id,
            User.username,
            User.full_name,
            func.count(Diagnosis.id).label("total_reviewed"),
            func.sum(case((Diagnosis.status == "APPROVED", 1), else_=0)).label("approved_cnt"),
            func.sum(case((Diagnosis.status == "REJECTED", 1), else_=0)).label("rejected_cnt"),
        )
        .join(Diagnosis, Diagnosis.expert_id == User.id)
        .group_by(User.id, User.username, User.full_name)
        .order_by(func.count(Diagnosis.id).desc(), User.username.asc())
        .limit(10)
        .all()
    )
    reviewer_stats = [
        {
            "expertId": int(uid),
            "username": str(username or ""),
            "displayName": str(full_name or username or f"Expert #{uid}"),
            "totalReviewed": int(total_rev or 0),
            "approvedCount": int(app_cnt or 0),
            "rejectedCount": int(rej_cnt or 0),
        }
        for uid, username, full_name, total_rev, app_cnt, rej_cnt in reviewer_rows
    ]

    recent_diagnoses = (
        Diagnosis.query
        .order_by(Diagnosis.created_at.desc(), Diagnosis.id.desc())
        .limit(25)
        .all()
    )
    recent_cases = [
        {
            "id": item.id,
            "cropName": str(item.crop_name or ""),
            "diseaseName": str(item.disease_name or "Unknown"),
            "status": str(item.status or "PENDING").upper(),
            "confidencePct": _confidence_to_pct(item.confidence),
            "farmerName": str(getattr(getattr(item, "farmer", None), "username", None) or "Farmer"),
            "expertName": str(
                getattr(getattr(item, "expert", None), "full_name", None)
                or getattr(getattr(item, "expert", None), "username", None)
                or ""
            ),
            "feedbackRating": str(item.feedback_rating or ""),
            "createdAt": item.created_at.isoformat() if item.created_at else None,
        }
        for item in recent_diagnoses
    ]

    return render_react_page(
        bootstrap_payload=build_admin_expert_stats_bootstrap(
            total_diagnoses=total,
            pending_count=pending,
            approved_count=resolved_total,
            status_counts=status_counts,
            avg_confidence=avg_confidence,
            feedback_counts=feedback_counts,
            crop_breakdown=crop_breakdown,
            disease_breakdown=disease_breakdown,
            reviewer_stats=reviewer_stats,
            recent_cases=recent_cases,
        ),
        title="Expert Statistics",
    )


@admin_bp.route("/expert-statistics/export")
@login_required
@permission_required("view_reports")
def expert_statistics_export():
    export_format = (request.args.get("format") or "csv").strip().lower()
    if export_format not in {"csv", "json"}:
        abort(400)

    def _csv_safe(value):
        text = "" if value is None else str(value)
        if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
            return f"'{text}"
        return text

    diagnoses = (
        Diagnosis.query
        .order_by(Diagnosis.created_at.desc(), Diagnosis.id.desc())
        .limit(5000)
        .all()
    )
    rows = [
        {
            "id": item.id,
            "crop": item.crop_name or "",
            "disease": item.disease_name or "",
            "status": (item.status or "").upper(),
            "confidence_pct": _confidence_to_pct(item.confidence),
            "farmer": getattr(getattr(item, "farmer", None), "username", None) or "",
            "expert": getattr(getattr(item, "expert", None), "username", None) or "",
            "feedback_rating": item.feedback_rating or "",
            "created_at": item.created_at.isoformat() if item.created_at else "",
        }
        for item in diagnoses
    ]

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="EXPERT_STATS_EXPORT",
            detail=f"format={export_format} count={len(rows)}",
        )
    )
    db.session.commit()

    if export_format == "json":
        return _json_response(
            {"exported_at": _now_dt().isoformat(), "diagnoses": rows},
            "expert_review_statistics.json",
        )
    safe_csv_rows = [
        {k: _csv_safe(v) if isinstance(v, str) else v for k, v in row.items()}
        for row in rows
    ]
    return _csv_response(
        safe_csv_rows,
        ["id", "crop", "disease", "status", "confidence_pct", "farmer", "expert", "feedback_rating", "created_at"],
        "expert_review_statistics.csv",
    )


# ==================================================
# DISEASE MANAGEMENT
# ==================================================
def _normalize_severity_level(raw: str | None) -> str:
    val = (raw or "").strip().lower()
    mapping = {
        "low": "Low",
        "medium": "Medium",
        "moderate": "Medium",
        "high": "High",
        "critical": "Critical",
        "severe": "Critical",
    }
    return mapping.get(val, "Low")


def _apply_disease_form(disease: Disease, form_data) -> tuple[bool, str | None]:
    crop_id = form_data.get("crop_id")
    name = (form_data.get("name") or "").strip()
    if not crop_id or not name:
        return False, "Crop and disease name are required"

    disease.crop_id = crop_id
    disease.name = name
    disease.name_kh = (form_data.get("name_kh") or "").strip() or None
    disease.description = (form_data.get("description") or "").strip() or None
    disease.description_kh = (form_data.get("description_kh") or "").strip() or None
    disease.cause_explanation = (form_data.get("cause_explanation") or "").strip() or None
    disease.cause_explanation_kh = (form_data.get("cause_explanation_kh") or "").strip() or None
    disease.treatment = (form_data.get("treatment") or "").strip() or None
    disease.treatment_kh = (form_data.get("treatment_kh") or "").strip() or None
    disease.prevention_tips = (form_data.get("prevention_tips") or "").strip() or None
    disease.prevention_tips_kh = (form_data.get("prevention_tips_kh") or "").strip() or None
    disease.severity_level = _normalize_severity_level(form_data.get("severity_level"))
    return True, None


@admin_bp.route("/diseases")
@login_required
@permission_required("manage_crops")
def diseases():
    diseases = Disease.query.order_by(Disease.id.desc()).all()
    crops = Crop.query.order_by(func.lower(Crop.name).asc()).all()
    return render_react_page(
        bootstrap_payload=build_admin_diseases_bootstrap(diseases=diseases, crops=crops),
        title="Disease Management",
    )


@admin_bp.route("/diseases/create", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def create_disease():
    crops = Crop.query.order_by(Crop.name.asc()).all()

    if request.method == "POST":
        disease = Disease()
        ok, err = _apply_disease_form(disease, request.form)
        if not ok:
            flash(err or "Invalid input", "danger")
            return redirect(request.url)

        db.session.add(disease)
        db.session.commit()

        flash("Disease added successfully", "success")
        return redirect(url_for("admin.diseases"))

    return render_react_page(
        bootstrap_payload=build_admin_disease_form_bootstrap(
            crops=crops,
            back_url=url_for("admin.diseases"),
            disease=None,
            edit_mode=False,
        ),
        title="Add Disease",
    )


@admin_bp.route("/diseases/<int:disease_id>/edit", methods=["GET", "POST"])
@login_required
@permission_required("manage_crops")
def edit_disease(disease_id):
    disease = Disease.query.get_or_404(disease_id)
    crops = Crop.query.order_by(Crop.name.asc()).all()

    if request.method == "POST":
        ok, err = _apply_disease_form(disease, request.form)
        if not ok:
            flash(err or "Invalid input", "danger")
            return redirect(request.url)
        db.session.commit()

        flash("Disease updated", "success")
        return redirect(url_for("admin.diseases"))

    return render_react_page(
        bootstrap_payload=build_admin_disease_form_bootstrap(
            crops=crops,
            disease=disease,
            edit_mode=True,
            back_url=url_for("admin.diseases"),
        ),
        title="Edit Disease",
    )


@admin_bp.route("/diseases/<int:disease_id>/delete", methods=["POST"])
@login_required
@permission_required("manage_crops")
def delete_disease(disease_id):
    disease = Disease.query.get_or_404(disease_id)
    Diagnosis.query.filter_by(disease_id=disease.id).update(
        {Diagnosis.disease_id: None}, synchronize_session=False
    )
    db.session.delete(disease)
    db.session.commit()

    flash("Disease deleted", "warning")
    return redirect(url_for("admin.diseases"))


@admin_bp.route("/diseases/bulk", methods=["POST"])
@login_required
@permission_required("manage_crops")
def diseases_bulk():
    action = request.form.get("action")
    scope = request.form.get("scope", "selected")

    if action != "delete":
        flash("Select a bulk action", "danger")
        return redirect(url_for("admin.diseases"))

    if scope == "all":
        diseases = Disease.query.all()
    else:
        disease_ids = request.form.getlist("disease_ids")
        if not disease_ids:
            flash("Select at least one disease", "warning")
            return redirect(url_for("admin.diseases"))
        diseases = Disease.query.filter(Disease.id.in_(disease_ids)).all()

    if not diseases:
        flash("No diseases found to delete", "warning")
        return redirect(url_for("admin.diseases"))

    target_ids = [d.id for d in diseases]
    Diagnosis.query.filter(Diagnosis.disease_id.in_(target_ids)).update(
        {Diagnosis.disease_id: None}, synchronize_session=False
    )
    for disease in diseases:
        db.session.delete(disease)
    db.session.commit()

    flash(f"Deleted {len(diseases)} disease(s)", "warning")
    return redirect(url_for("admin.diseases"))


# ==================================================
# TRANSLATION CENTER
# ==================================================
_TRANSLATION_RATE_LIMIT_LOCK = threading.Lock()
_TRANSLATION_RATE_LIMIT = {
    "window_seconds": 60,
    "max_requests": 40,
    "buckets": {},
}


def _rate_limited(ip: str) -> bool:
    now = _now_dt().timestamp()
    window = _TRANSLATION_RATE_LIMIT["window_seconds"]
    with _TRANSLATION_RATE_LIMIT_LOCK:
        buckets = _TRANSLATION_RATE_LIMIT["buckets"]
        if len(buckets) > 2000:
            expired = [k for k, v in buckets.items() if now - v["start"] > window]
            for k in expired:
                buckets.pop(k, None)
        bucket = buckets.get(ip)
        if not bucket or now - bucket["start"] > window:
            buckets[ip] = {"start": now, "count": 1}
            return False
        bucket["count"] += 1
        return bucket["count"] > _TRANSLATION_RATE_LIMIT["max_requests"]


def _save_translation_backup(scope: str, payload: dict):
    backup = TranslationBackup(scope=scope, payload=json.dumps(payload, ensure_ascii=False))
    db.session.add(backup)
    # keep only the latest 20 backups
    old = (
        TranslationBackup.query
        .order_by(TranslationBackup.created_at.desc())
        .offset(20)
        .all()
    )
    for item in old:
        db.session.delete(item)

def translation_access_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not (current_user.has_role("admin") or current_user.has_role("expert") or current_user.has_permission("manage_crops")):
            abort(403)
        return f(*args, **kwargs)
    return login_required(decorated_function)

@admin_bp.route("/translations", methods=["GET", "POST"])
@translation_access_required
def translations():
    section = (request.values.get("section") or "").strip().lower() or "crops"
    missing_only = (request.values.get("missing") or "").strip().lower() == "1"
    q = (request.values.get("q") or "").strip()

    def _apply_filters(query, name_col, name_kh_col, desc_col=None, desc_kh_col=None, treat_col=None, treat_kh_col=None):
        if q:
            like = f"%{q}%"
            clauses = [name_col.ilike(like), name_kh_col.ilike(like)]
            if desc_col is not None:
                clauses.append(desc_col.ilike(like))
            if desc_kh_col is not None:
                clauses.append(desc_kh_col.ilike(like))
            query = query.filter(or_(*clauses))
        if missing_only:
            missing_clauses = [name_kh_col.is_(None), name_kh_col == ""]
            if desc_col is not None and desc_kh_col is not None:
                missing_clauses.append(
                    db.and_(
                        desc_col.isnot(None),
                        desc_col != "",
                        or_(desc_kh_col.is_(None), desc_kh_col == ""),
                    )
                )
            if treat_col is not None and treat_kh_col is not None:
                missing_clauses.append(
                    db.and_(
                        treat_col.isnot(None),
                        treat_col != "",
                        or_(treat_kh_col.is_(None), treat_kh_col == ""),
                    )
                )
            query = query.filter(or_(*missing_clauses))
        return query

    if request.method == "POST":
        action = (request.form.get("action") or "save").strip().lower()
        updated = 0

        if action == "export":
            export_section = (request.form.get("section") or "").strip().lower()
            if export_section not in {"crops", "diseases", "symptoms"}:
                flash("Select a valid section to export.", "warning")
                return redirect(url_for("admin.translations"))

            if export_section == "crops":
                query = _apply_filters(Crop.query, Crop.name, Crop.name_kh)
                rows = [
                    {
                        "id": c.id,
                        "name_en": c.name,
                        "name_kh": c.name_kh or "",
                        "description_en": c.description or "",
                        "description_kh": c.description_kh or "",
                    }
                    for c in query.order_by(Crop.name.asc()).all()
                ]
                fieldnames = ["id", "name_en", "name_kh", "description_en", "description_kh"]
                return _csv_response(rows, fieldnames, "translations_crops.csv")

            if export_section == "diseases":
                query = _apply_filters(Disease.query, Disease.name, Disease.name_kh)
                rows = [
                    {
                        "id": d.id,
                        "name_en": d.name,
                        "name_kh": d.name_kh or "",
                        "description_en": d.description or "",
                        "description_kh": d.description_kh or "",
                        "treatment_en": d.treatment or "",
                        "treatment_kh": d.treatment_kh or "",
                    }
                    for d in query.order_by(Disease.name.asc()).all()
                ]
                fieldnames = [
                    "id",
                    "name_en",
                    "name_kh",
                    "description_en",
                    "description_kh",
                    "treatment_en",
                    "treatment_kh",
                ]
                return _csv_response(rows, fieldnames, "translations_diseases.csv")

            query = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh)
            rows = [
                {
                    "id": s.id,
                    "name_en": s.name,
                    "name_kh": s.name_kh or "",
                    "description_en": s.description or "",
                    "description_kh": s.description_kh or "",
                }
                for s in query.order_by(Symptom.name.asc()).all()
            ]
            fieldnames = ["id", "name_en", "name_kh", "description_en", "description_kh"]
            return _csv_response(rows, fieldnames, "translations_symptoms.csv")

        if action == "export_all":
            crops = Crop.query.order_by(Crop.name.asc()).all()
            diseases = Disease.query.order_by(Disease.name.asc()).all()
            symptoms = Symptom.query.order_by(Symptom.name.asc()).all()

            crops_rows = [
                {
                    "id": c.id,
                    "name_en": c.name,
                    "name_kh": c.name_kh or "",
                    "description_en": c.description or "",
                    "description_kh": c.description_kh or "",
                }
                for c in crops
            ]
            crops_csv = StringIO()
            crop_writer = csv.DictWriter(
                crops_csv,
                fieldnames=["id", "name_en", "name_kh", "description_en", "description_kh"]
            )
            crop_writer.writeheader()
            for row in crops_rows:
                crop_writer.writerow(row)

            disease_rows = [
                {
                    "id": d.id,
                    "name_en": d.name,
                    "name_kh": d.name_kh or "",
                    "description_en": d.description or "",
                    "description_kh": d.description_kh or "",
                    "treatment_en": d.treatment or "",
                    "treatment_kh": d.treatment_kh or "",
                }
                for d in diseases
            ]
            disease_csv = StringIO()
            disease_writer = csv.DictWriter(
                disease_csv,
                fieldnames=[
                    "id",
                    "name_en",
                    "name_kh",
                    "description_en",
                    "description_kh",
                    "treatment_en",
                    "treatment_kh",
                ],
            )
            disease_writer.writeheader()
            for row in disease_rows:
                disease_writer.writerow(row)

            symptom_rows = [
                {
                    "id": s.id,
                    "name_en": s.name,
                    "name_kh": s.name_kh or "",
                    "description_en": s.description or "",
                    "description_kh": s.description_kh or "",
                }
                for s in symptoms
            ]
            symptom_csv = StringIO()
            symptom_writer = csv.DictWriter(
                symptom_csv,
                fieldnames=["id", "name_en", "name_kh", "description_en", "description_kh"]
            )
            symptom_writer.writeheader()
            for row in symptom_rows:
                symptom_writer.writerow(row)

            return _zip_response(
                {
                    "translations_crops.csv": crops_csv.getvalue(),
                    "translations_diseases.csv": disease_csv.getvalue(),
                    "translations_symptoms.csv": symptom_csv.getvalue(),
                },
                "translations_all.zip",
            )

        if action == "import":
            import_section = (request.form.get("section") or "").strip().lower()
            upload = request.files.get("file")
            if import_section not in {"crops", "diseases", "symptoms"} or not upload:
                flash("Select a valid section and CSV file to import.", "warning")
                return redirect(url_for("admin.translations"))
            try:
                content = upload.read().decode("utf-8")
            except Exception:  # noqa: BLE001
                flash("Unable to read CSV file.", "danger")
                return redirect(url_for("admin.translations"))
            reader = csv.DictReader(StringIO(content))
            if not reader.fieldnames:
                flash("CSV file is missing headers.", "danger")
                return redirect(url_for("admin.translations"))

            if import_section == "crops":
                snapshot = {
                    "scope": "crops",
                    "items": [
                        {
                            "id": c.id,
                            "name_kh": c.name_kh,
                            "description_kh": c.description_kh,
                        }
                        for c in Crop.query.order_by(Crop.id.asc()).all()
                    ],
                }
                _save_translation_backup("crops", snapshot)
                for row in reader:
                    try:
                        crop_id = int(row.get("id") or 0)
                    except (TypeError, ValueError):
                        continue
                    crop = Crop.query.get(crop_id)
                    if not crop:
                        continue
                    name_kh = (row.get("name_kh") or "").strip() or None
                    desc_kh = (row.get("description_kh") or "").strip() or None
                    if crop.name_kh != name_kh:
                        crop.name_kh = name_kh
                        updated += 1
                    if crop.description_kh != desc_kh:
                        crop.description_kh = desc_kh
                        updated += 1
                db.session.commit()
                flash(f"Imported {updated} crop field(s).", "success")
                return redirect(url_for("admin.translations") + "#crops")

            if import_section == "diseases":
                snapshot = {
                    "scope": "diseases",
                    "items": [
                        {
                            "id": d.id,
                            "name_kh": d.name_kh,
                            "description_kh": d.description_kh,
                            "treatment_kh": d.treatment_kh,
                        }
                        for d in Disease.query.order_by(Disease.id.asc()).all()
                    ],
                }
                _save_translation_backup("diseases", snapshot)
                for row in reader:
                    try:
                        disease_id = int(row.get("id") or 0)
                    except (TypeError, ValueError):
                        continue
                    disease = Disease.query.get(disease_id)
                    if not disease:
                        continue
                    name_kh = (row.get("name_kh") or "").strip() or None
                    desc_kh = (row.get("description_kh") or "").strip() or None
                    treat_kh = (row.get("treatment_kh") or "").strip() or None
                    if disease.name_kh != name_kh:
                        disease.name_kh = name_kh
                        updated += 1
                    if disease.description_kh != desc_kh:
                        disease.description_kh = desc_kh
                        updated += 1
                    if disease.treatment_kh != treat_kh:
                        disease.treatment_kh = treat_kh
                        updated += 1
                db.session.commit()
                flash(f"Imported {updated} disease field(s).", "success")
                return redirect(url_for("admin.translations") + "#diseases")

            snapshot = {
                "scope": "symptoms",
                "items": [
                    {
                        "id": s.id,
                        "name_kh": s.name_kh,
                        "description_kh": s.description_kh,
                    }
                    for s in Symptom.query.order_by(Symptom.id.asc()).all()
                ],
            }
            _save_translation_backup("symptoms", snapshot)
            for row in reader:
                try:
                    symptom_id = int(row.get("id") or 0)
                except (TypeError, ValueError):
                    continue
                symptom = Symptom.query.get(symptom_id)
                if not symptom:
                    continue
                name_kh = (row.get("name_kh") or "").strip() or None
                desc_kh = (row.get("description_kh") or "").strip() or None
                if symptom.name_kh != name_kh:
                    symptom.name_kh = name_kh
                    updated += 1
                if symptom.description_kh != desc_kh:
                    symptom.description_kh = desc_kh
                    updated += 1
            db.session.commit()
            flash(f"Imported {updated} symptom field(s).", "success")
            return redirect(url_for("admin.translations") + "#symptoms")

        if action == "import_all":
            upload = request.files.get("file")
            if not upload:
                flash("Select a ZIP file to import.", "warning")
                return redirect(url_for("admin.translations"))
            try:
                data = upload.read()
                zf = zipfile.ZipFile(BytesIO(data))
            except Exception:  # noqa: BLE001
                flash("Unable to read ZIP file.", "danger")
                return redirect(url_for("admin.translations"))

            snapshot = {
                "scope": "all",
                "crops": [
                    {"id": c.id, "name_kh": c.name_kh, "description_kh": c.description_kh}
                    for c in Crop.query.order_by(Crop.id.asc()).all()
                ],
                "diseases": [
                    {
                        "id": d.id,
                        "name_kh": d.name_kh,
                        "description_kh": d.description_kh,
                        "treatment_kh": d.treatment_kh,
                    }
                    for d in Disease.query.order_by(Disease.id.asc()).all()
                ],
                "symptoms": [
                    {"id": s.id, "name_kh": s.name_kh, "description_kh": s.description_kh}
                    for s in Symptom.query.order_by(Symptom.id.asc()).all()
                ],
            }
            _save_translation_backup("all", snapshot)

            def _import_csv(content, section_name):
                nonlocal updated
                reader = csv.DictReader(StringIO(content))
                if not reader.fieldnames:
                    return
                if section_name == "crops":
                    for row in reader:
                        try:
                            crop_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        crop = Crop.query.get(crop_id)
                        if not crop:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        if crop.name_kh != name_kh:
                            crop.name_kh = name_kh
                            updated += 1
                        if crop.description_kh != desc_kh:
                            crop.description_kh = desc_kh
                            updated += 1
                elif section_name == "diseases":
                    for row in reader:
                        try:
                            disease_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        disease = Disease.query.get(disease_id)
                        if not disease:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        treat_kh = (row.get("treatment_kh") or "").strip() or None
                        if disease.name_kh != name_kh:
                            disease.name_kh = name_kh
                            updated += 1
                        if disease.description_kh != desc_kh:
                            disease.description_kh = desc_kh
                            updated += 1
                        if disease.treatment_kh != treat_kh:
                            disease.treatment_kh = treat_kh
                            updated += 1
                elif section_name == "symptoms":
                    for row in reader:
                        try:
                            symptom_id = int(row.get("id") or 0)
                        except (TypeError, ValueError):
                            continue
                        symptom = Symptom.query.get(symptom_id)
                        if not symptom:
                            continue
                        name_kh = (row.get("name_kh") or "").strip() or None
                        desc_kh = (row.get("description_kh") or "").strip() or None
                        if symptom.name_kh != name_kh:
                            symptom.name_kh = name_kh
                            updated += 1
                        if symptom.description_kh != desc_kh:
                            symptom.description_kh = desc_kh
                            updated += 1

            for filename in zf.namelist():
                name = filename.lower()
                if name.endswith(".csv"):
                    if "crops" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "crops")
                    elif "diseases" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "diseases")
                    elif "symptoms" in name:
                        _import_csv(zf.read(filename).decode("utf-8"), "symptoms")

            db.session.commit()
            flash(f"Imported {updated} field(s) from ZIP.", "success")
            return redirect(url_for("admin.translations"))

        if section == "crops":
            crops = _apply_filters(Crop.query, Crop.name, Crop.name_kh, Crop.description, Crop.description_kh).order_by(Crop.name.asc()).all()
            snapshot_items = []
            for crop in crops:
                name_key = f"crop_name_kh_{crop.id}"
                desc_key = f"crop_desc_kh_{crop.id}"
                if name_key not in request.form and desc_key not in request.form:
                    continue
                snapshot_items.append({"id": crop.id, "name_kh": crop.name_kh, "description_kh": crop.description_kh})
                if name_key in request.form:
                    name_kh = (request.form.get(name_key) or "").strip() or None
                    if crop.name_kh != name_kh:
                        crop.name_kh = name_kh
                        updated += 1
                if desc_key in request.form:
                    desc_kh = (request.form.get(desc_key) or "").strip() or None
                    if crop.description_kh != desc_kh:
                        crop.description_kh = desc_kh
                        updated += 1
            if updated > 0 and snapshot_items:
                _save_translation_backup("crops", {"scope": "crops", "items": snapshot_items})
            db.session.commit()
            flash(f"Updated {updated} crop field(s).", "success")
            return redirect(url_for("admin.translations", section="crops", q=q, missing=("1" if missing_only else "0")) + "#crops")

        if section == "diseases":
            diseases = _apply_filters(
                Disease.query,
                Disease.name,
                Disease.name_kh,
                Disease.description,
                Disease.description_kh,
                Disease.treatment,
                Disease.treatment_kh,
            ).order_by(Disease.name.asc()).all()
            snapshot_items = []
            for disease in diseases:
                name_key = f"disease_name_kh_{disease.id}"
                desc_key = f"disease_desc_kh_{disease.id}"
                treat_key = f"disease_treatment_kh_{disease.id}"
                if name_key not in request.form and desc_key not in request.form and treat_key not in request.form:
                    continue
                snapshot_items.append({
                    "id": disease.id,
                    "name_kh": disease.name_kh,
                    "description_kh": disease.description_kh,
                    "treatment_kh": disease.treatment_kh,
                })
                if name_key in request.form:
                    name_kh = (request.form.get(name_key) or "").strip() or None
                    if disease.name_kh != name_kh:
                        disease.name_kh = name_kh
                        updated += 1
                if desc_key in request.form:
                    desc_kh = (request.form.get(desc_key) or "").strip() or None
                    if disease.description_kh != desc_kh:
                        disease.description_kh = desc_kh
                        updated += 1
                if treat_key in request.form:
                    treat_kh = (request.form.get(treat_key) or "").strip() or None
                    if disease.treatment_kh != treat_kh:
                        disease.treatment_kh = treat_kh
                        updated += 1
            if updated > 0 and snapshot_items:
                _save_translation_backup("diseases", {"scope": "diseases", "items": snapshot_items})
            db.session.commit()
            flash(f"Updated {updated} disease field(s).", "success")
            return redirect(url_for("admin.translations", section="diseases", q=q, missing=("1" if missing_only else "0")) + "#diseases")

        if section == "symptoms":
            symptoms = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh, Symptom.description, Symptom.description_kh).order_by(Symptom.name.asc()).all()
            snapshot_items = []
            for symptom in symptoms:
                name_key = f"symptom_name_kh_{symptom.id}"
                desc_key = f"symptom_desc_kh_{symptom.id}"
                if name_key not in request.form and desc_key not in request.form:
                    continue
                snapshot_items.append({"id": symptom.id, "name_kh": symptom.name_kh, "description_kh": symptom.description_kh})
                if name_key in request.form:
                    name_kh = (request.form.get(name_key) or "").strip() or None
                    if symptom.name_kh != name_kh:
                        symptom.name_kh = name_kh
                        updated += 1
                if desc_key in request.form:
                    desc_kh = (request.form.get(desc_key) or "").strip() or None
                    if symptom.description_kh != desc_kh:
                        symptom.description_kh = desc_kh
                        updated += 1
            if updated > 0 and snapshot_items:
                _save_translation_backup("symptoms", {"scope": "symptoms", "items": snapshot_items})
            db.session.commit()
            flash(f"Updated {updated} symptom field(s).", "success")
            return redirect(url_for("admin.translations", section="symptoms", q=q, missing=("1" if missing_only else "0")) + "#symptoms")

        flash("Select a valid section to update.", "warning")
        return redirect(url_for("admin.translations"))

    crops = _apply_filters(Crop.query, Crop.name, Crop.name_kh, Crop.description, Crop.description_kh).order_by(Crop.name.asc()).all()
    diseases = _apply_filters(
        Disease.query,
        Disease.name,
        Disease.name_kh,
        Disease.description,
        Disease.description_kh,
        Disease.treatment,
        Disease.treatment_kh,
    ).order_by(Disease.name.asc()).all()
    symptoms = _apply_filters(Symptom.query, Symptom.name, Symptom.name_kh, Symptom.description, Symptom.description_kh).order_by(Symptom.name.asc()).all()

    coverage_stats = {
        "crops": {
            "total": Crop.query.count(),
            "translated": Crop.query.filter(Crop.name_kh.isnot(None), Crop.name_kh != "").count(),
        },
        "diseases": {
            "total": Disease.query.count(),
            "translated": Disease.query.filter(Disease.name_kh.isnot(None), Disease.name_kh != "").count(),
        },
        "symptoms": {
            "total": Symptom.query.count(),
            "translated": Symptom.query.filter(Symptom.name_kh.isnot(None), Symptom.name_kh != "").count(),
        },
    }

    return render_react_page(
        bootstrap_payload=build_admin_translations_bootstrap(
            crops=crops,
            diseases=diseases,
            symptoms=symptoms,
            current_section=section,
            q=q,
            missing_only=missing_only,
            coverage_stats=coverage_stats,
        ),
        title="Khmer Translations",
    )


@admin_bp.route("/translations/ai", methods=["POST"])
@translation_access_required
def translations_ai():
    if not request.is_json:
        return jsonify({"ok": False, "error": "Invalid request"}), 400
    ip = get_client_ip()
    if ip == "-":
        ip = "unknown"
    if _rate_limited(ip):
        return jsonify({"ok": False, "error": "Rate limit exceeded"}), 429
    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if len(text) > 800:
        return jsonify({"ok": False, "error": "Text too long"}), 400
    if not text:
        return jsonify({"ok": False, "error": "No text provided"}), 400
    model = payload.get("model")
    translated = translate_to_khmer(text, model_choice=model)
    if not translated:
        return jsonify({"ok": False, "error": "Translation service unavailable"}), 503
    return jsonify({"success": True, "translation": translated})


@admin_bp.route("/settings", methods=["GET", "POST"])
@login_required
@permission_required("manage_roles")
def settings():
    def update_setting(k, v):
        setting = SiteSetting.query.get(k)
        if setting:
            setting.value = v
        else:
            setting = SiteSetting(key=k, value=v)
            db.session.add(setting)

    def _load_profiles():
        models_setting = SiteSetting.query.get("HF_MODELS")
        try:
            profiles = json.loads(models_setting.value) if models_setting and models_setting.value else []
        except (TypeError, ValueError):
            profiles = []
        if not isinstance(profiles, list):
            profiles = []
        return models_setting, [p for p in profiles if isinstance(p, dict)]

    def _save_profiles(models_setting, profiles):
        payload = json.dumps(profiles, ensure_ascii=False)
        if models_setting:
            models_setting.value = payload
        else:
            db.session.add(SiteSetting(key="HF_MODELS", value=payload))

    def _activate_profile_state(profiles, target_id):
        chosen = None
        for profile in profiles:
            is_target = profile.get("id") == target_id
            profile["active"] = is_target
            if is_target:
                chosen = profile
        update_setting("HF_ACTIVE_MODEL", target_id if chosen else "")
        update_setting("AI_PROVIDER", "own-ai")
        current_app.config["AI_PROVIDER"] = "own-ai"
        if chosen:
            chosen_model_id = str(chosen.get("model_id") or "").strip()
            chosen_endpoint = str(chosen.get("endpoint") or "").strip()
            if chosen_model_id:
                update_setting("HF_MODEL_ID", chosen_model_id)
            if chosen_endpoint:
                update_setting("HF_INFERENCE_URL", chosen_endpoint)
                current_app.config["HF_INFERENCE_URL"] = chosen_endpoint
            token_key = str(chosen.get("token_key") or "").strip()
            token_setting = SiteSetting.query.get(token_key) if token_key else None
            if token_setting and token_setting.value and token_setting.value.strip():
                current_app.config["HF_TOKEN"] = token_setting.value.strip()
        return chosen

    if request.method == "POST":
        form_type = (request.form.get("form_type") or "").strip()

        # General System & Location Settings
        if form_type == "general" or "server_location_name" in request.form:
            system_name = request.form.get("system_name", "").strip()
            server_loc_name = request.form.get("server_location_name", "").strip()
            server_loc_lat = request.form.get("server_location_lat", "").strip()
            server_loc_lon = request.form.get("server_location_lon", "").strip()

            if server_loc_lat:
                try:
                    lat_val = float(server_loc_lat)
                    if not (-90.0 <= lat_val <= 90.0):
                        raise ValueError("Latitude out of range")
                except (TypeError, ValueError):
                    flash("Enter a valid latitude between -90 and 90.", "danger")
                    return redirect(url_for("admin.settings", tab="general"))

            if server_loc_lon:
                try:
                    lon_val = float(server_loc_lon)
                    if not (-180.0 <= lon_val <= 180.0):
                        raise ValueError("Longitude out of range")
                except (TypeError, ValueError):
                    flash("Enter a valid longitude between -180 and 180.", "danger")
                    return redirect(url_for("admin.settings", tab="general"))

            if system_name:
                update_setting("SYSTEM_NAME", system_name[:120])
                current_app.config["SYSTEM_NAME"] = system_name[:120]
            if server_loc_name:
                update_setting("SERVER_LOCATION_NAME", server_loc_name[:160])
            if server_loc_lat:
                update_setting("SERVER_LOCATION_LAT", server_loc_lat)
            if server_loc_lon:
                update_setting("SERVER_LOCATION_LON", server_loc_lon)

            db.session.add(
                AuditLog(
                    user_id=current_user.id,
                    action="UPDATE_SYSTEM_SETTINGS",
                    detail=f"system={system_name or '-'} location={server_loc_name or '-'} lat={server_loc_lat or '-'} lon={server_loc_lon or '-'}",
                )
            )
            db.session.commit()
            flash("General system & server location settings saved successfully.", "success")
            return redirect(url_for("admin.settings", tab="general"))

        model_action = (request.form.get("model_action") or "").strip().lower()

        if model_action:
            models_setting, profiles = _load_profiles()
            profile_id = re.sub(r"[^a-z0-9-]+", "-", (request.form.get("profile_id") or "").lower()).strip("-")

            if model_action == "delete":
                deleted = next((p for p in profiles if p.get("id") == profile_id), None)
                profiles = [p for p in profiles if p.get("id") != profile_id]
                if deleted and deleted.get("token_key"):
                    token_setting = SiteSetting.query.get(deleted["token_key"])
                    if token_setting:
                        db.session.delete(token_setting)
                active_setting = SiteSetting.query.get("HF_ACTIVE_MODEL")
                if active_setting and active_setting.value == profile_id:
                    next_id = profiles[0].get("id", "") if profiles else ""
                    _activate_profile_state(profiles, next_id)
                _save_profiles(models_setting, profiles)
                db.session.add(
                    AuditLog(
                        user_id=current_user.id,
                        action="DELETE_AI_MODEL",
                        detail=f"profile={profile_id or '-'}",
                    )
                )
                db.session.commit()
                flash("Trained AI model removed.", "success")
                return redirect(url_for("admin.settings", tab="trained"))

            if model_action == "switch":
                target = _activate_profile_state(profiles, profile_id)
                if not target:
                    flash("Selected trained model profile was not found.", "warning")
                    return redirect(url_for("admin.settings", tab="trained"))
                _save_profiles(models_setting, profiles)
                db.session.add(
                    AuditLog(
                        user_id=current_user.id,
                        action="SWITCH_AI_MODEL",
                        detail=f"profile={profile_id} model={target.get('model_id', '')}",
                    )
                )
                db.session.commit()
                flash(f"Activated trained model profile: {target.get('label') or target.get('model_id')}.", "success")
                return redirect(url_for("admin.settings", tab="trained"))

            model_id = (request.form.get("model_id") or "").strip()
            endpoint = (request.form.get("endpoint") or "").strip()
            label = (request.form.get("label") or model_id or "Trained model").strip()[:120]
            api_key = (request.form.get("model_api_key") or "").strip()

            if not model_id or not endpoint or not is_valid_inference_endpoint(endpoint):
                flash("Enter a model ID and a valid deployed inference endpoint URL.", "danger")
                return redirect(url_for("admin.settings", tab="trained"))
            if not profile_id:
                profile_id = re.sub(r"[^a-z0-9-]+", "-", model_id.lower()).strip("-") or "trained-model"
                profile_id = profile_id[:32].strip("-") or "trained-model"
                base_id, suffix = profile_id, 2
                while any(p.get("id") == profile_id for p in profiles):
                    profile_id = f"{base_id}-{suffix}"
                    suffix += 1
            token_key = f"HF_API_KEY_{profile_id.upper().replace('-', '_')}"
            existing = next((p for p in profiles if p.get("id") == profile_id), None)
            if not existing:
                existing = {"id": profile_id, "token_key": token_key}
                profiles.append(existing)
            existing.update({"label": label, "model_id": model_id, "endpoint": endpoint, "token_key": token_key})
            if api_key:
                update_setting(token_key, api_key)

            should_activate = model_action == "activate" or bool(request.form.get("activate_model"))
            if should_activate or existing.get("active"):
                _activate_profile_state(profiles, profile_id)
            _save_profiles(models_setting, profiles)
            db.session.add(
                AuditLog(
                    user_id=current_user.id,
                    action="SAVE_AI_MODEL",
                    detail=f"profile={profile_id} model={model_id} activate={should_activate}",
                )
            )
            db.session.commit()
            flash(
                "Trained AI model saved and activated." if should_activate else "Trained AI model saved.",
                "success",
            )
            return redirect(url_for("admin.settings", tab="trained"))

        # The current configuration screen manages the owner's separately
        # hosted, fine-tuned agricultural model. Legacy commercial-provider
        # fields are intentionally rejected and are never persisted.
        own_ai_form = any(
            key in request.form
            for key in ("hf_model_id", "hf_inference_url", "hf_api_key", "legacy_fallback_enabled")
        )

        if own_ai_form:
            hf_model_id = request.form.get("hf_model_id", "").strip()
            hf_inference_url = request.form.get("hf_inference_url", "").strip()
            hf_api_key = request.form.get("hf_api_key", "").strip()
            fallback_enabled = "false"

            if hf_inference_url and not is_valid_inference_endpoint(hf_inference_url):
                flash("Enter a valid deployed inference endpoint URL (https://.../generate or .hf.space).", "danger")
                return redirect(url_for("admin.settings", tab="trained"))

            update_setting("AI_PROVIDER", "own-ai")
            update_setting("HF_MODEL_ID", hf_model_id)
            update_setting("HF_INFERENCE_URL", hf_inference_url)
            update_setting("AI_LEGACY_FALLBACK_ENABLED", fallback_enabled)
            if hf_api_key:
                update_setting("HF_API_KEY", hf_api_key)

            # Keep the currently active registered profile in sync so reloading
            # /admin/settings reflects the newly saved endpoint immediately.
            models_setting, profiles = _load_profiles()
            active_setting = SiteSetting.query.get("HF_ACTIVE_MODEL")
            active_id = active_setting.value.strip() if active_setting and active_setting.value else ""
            if active_id:
                active_prof = next((p for p in profiles if p.get("id") == active_id), None)
                if active_prof:
                    if hf_model_id:
                        active_prof["model_id"] = hf_model_id
                    if hf_inference_url:
                        active_prof["endpoint"] = hf_inference_url
                    if hf_api_key and active_prof.get("token_key"):
                        update_setting(active_prof["token_key"], hf_api_key)
                    _save_profiles(models_setting, profiles)

            db.session.add(
                AuditLog(
                    user_id=current_user.id,
                    action="UPDATE_AI_SETTINGS",
                    detail=f"model={hf_model_id or '-'} endpoint_set={bool(hf_inference_url)} key_updated={bool(hf_api_key)}",
                )
            )
            db.session.commit()
            current_app.config["AI_PROVIDER"] = "own-ai"
            current_app.config["HF_INFERENCE_URL"] = hf_inference_url
            current_app.config["AI_LEGACY_FALLBACK_ENABLED"] = False
            if hf_api_key:
                current_app.config["HF_TOKEN"] = hf_api_key
            flash("Own AI engine settings saved successfully.", "success")
            return redirect(url_for("admin.settings", tab="trained"))

        update_setting("AI_PROVIDER", "own-ai")
        update_setting("AI_LEGACY_FALLBACK_ENABLED", "false")
        db.session.commit()
        flash("Only your self-trained AI is supported. Configure it in Trained Models.", "warning")
        return redirect(url_for("admin.settings", tab="trained"))

    # GET
    hf_model_setting = SiteSetting.query.get("HF_MODEL_ID")
    hf_url_setting = SiteSetting.query.get("HF_INFERENCE_URL")
    hf_key_setting = SiteSetting.query.get("HF_API_KEY") or SiteSetting.query.get("HF_TOKEN")
    fallback_setting = SiteSetting.query.get("AI_LEGACY_FALLBACK_ENABLED")

    hf_model_id = (
        hf_model_setting.value.strip() if hf_model_setting and hf_model_setting.value.strip()
        else os.getenv("HF_MODEL_ID", "Maoseavik/agri-qwen3b-lora").strip()
    )
    hf_inference_url = (
        hf_url_setting.value.strip() if hf_url_setting and hf_url_setting.value.strip()
        else current_app.config.get("HF_INFERENCE_URL", "")
    )
    fallback_value = (
        fallback_setting.value.strip().lower()
        if fallback_setting and fallback_setting.value
        else str(current_app.config.get("AI_LEGACY_FALLBACK_ENABLED", False)).lower()
    )

    _, raw_hf_models = _load_profiles()
    active_model_setting = SiteSetting.query.get("HF_ACTIVE_MODEL")
    active_model_id = active_model_setting.value.strip() if active_model_setting and active_model_setting.value else ""
    hf_models = []
    for p in raw_hf_models:
        token_key = str(p.get("token_key") or "").strip()
        token_obj = SiteSetting.query.get(token_key) if token_key else None
        hf_models.append({
            "id": p.get("id", ""),
            "label": p.get("label", ""),
            "model_id": p.get("model_id", ""),
            "endpoint": p.get("endpoint", ""),
            "active": bool(p.get("id") == active_model_id or p.get("active")),
            "has_token": bool(token_obj and token_obj.value and token_obj.value.strip()),
        })

    active_model = next((p for p in hf_models if p.get("id") == active_model_id), None)
    if active_model:
        hf_model_id = (active_model.get("model_id") or hf_model_id).strip()
        hf_inference_url = (active_model.get("endpoint") or hf_inference_url).strip()
    edit_model_id = (request.args.get("edit_model_id") or "").strip()
    editing_model = next((p for p in hf_models if p.get("id") == edit_model_id), None)
    active_raw = next((p for p in raw_hf_models if p.get("id") == active_model_id), None)
    active_token_setting = (
        SiteSetting.query.get(active_raw.get("token_key"))
        if active_raw and active_raw.get("token_key") else None
    )

    active_provider = "own-ai"

    # General / Server Location Settings
    system_name_setting = SiteSetting.query.get("SYSTEM_NAME")
    system_name = system_name_setting.value.strip() if system_name_setting and system_name_setting.value else "AgriSystem"
    server_location_name, server_location_lat, server_location_lon = _get_server_location_defaults()

    from app.blueprints.farmer.support_chat import CAMBODIA_PROVINCES
    active_tab = request.args.get("tab", "general")

    return render_react_page(
        bootstrap_payload=build_admin_settings_bootstrap(
            active_tab=active_tab,
            system_name=system_name,
            server_location_name=server_location_name,
            server_location_lat=server_location_lat,
            server_location_lon=server_location_lon,
            cambodia_provinces=CAMBODIA_PROVINCES,
            active_provider=active_provider,
            hf_model_id=hf_model_id,
            hf_inference_url=hf_inference_url,
            hf_key_configured=bool(hf_key_setting and hf_key_setting.value.strip()) or bool(current_app.config.get("HF_TOKEN")) or bool(
                active_token_setting and active_token_setting.value.strip()
            ),
            legacy_fallback_enabled=fallback_value in {"1", "true", "yes", "on"},
            hf_models=hf_models,
            active_model_id=active_model_id,
            editing_model=editing_model,
        ),
        title="System & AI Settings",
        react_ssr_html=build_admin_settings_ssr_html(),
    )


@admin_bp.route("/api/test_ai_connection", methods=["POST"])
@login_required
@permission_required("manage_roles")
def test_ai_connection():
    data = request.get_json(silent=True) or request.form
    provider = (data.get("provider") or "own-ai").strip().lower()
    api_key = (data.get("api_key") or "").strip()

    if provider not in {"own-ai", "trained-ai", "huggingface", "hf", "hugging_face"}:
        return jsonify({"success": False, "error": "Commercial LLM providers are disabled. Use your self-trained AI endpoint."}), 410

    if provider in {"own-ai", "trained-ai", "huggingface", "hf", "hugging_face"}:
        saved_url = SiteSetting.query.get("HF_INFERENCE_URL")
        endpoint = (data.get("endpoint") or data.get("url") or "").strip()
        endpoint = endpoint or (saved_url.value.strip() if saved_url and saved_url.value else "")
        if not endpoint:
            endpoint = (current_app.config.get("HF_INFERENCE_URL") or "").strip()
        if not is_valid_inference_endpoint(endpoint):
            return jsonify({
                "success": False,
                "error": "Enter the deployed inference endpoint URL (for example https://.../generate), not a Hugging Face model ID.",
            }), 400

        token = api_key
        # The trained-model form stores each endpoint key under its profile's
        # token_key. Reuse that key when the password field is intentionally
        # left blank (the normal edit/test workflow).
        if not token:
            models_setting = SiteSetting.query.get("HF_MODELS")
            try:
                profiles = json.loads(models_setting.value) if models_setting and models_setting.value else []
            except (TypeError, ValueError):
                profiles = []
            if isinstance(profiles, list):
                endpoint_normalized = endpoint.rstrip("/")
                matching_profile = next(
                    (
                        profile for profile in profiles
                        if isinstance(profile, dict)
                        and str(profile.get("endpoint") or "").strip().rstrip("/") == endpoint_normalized
                    ),
                    None,
                )
                token_key = matching_profile.get("token_key") if matching_profile else ""
                profile_key = SiteSetting.query.get(token_key) if token_key else None
                if profile_key and profile_key.value:
                    token = profile_key.value.strip()
        if not token:
            saved_key = SiteSetting.query.get("HF_API_KEY") or SiteSetting.query.get("HF_TOKEN")
            token = saved_key.value.strip() if saved_key and saved_key.value else ""
        token = token or (current_app.config.get("HF_TOKEN") or "").strip()
        start_time = time.time()
        try:
            reply = request_endpoint(
                endpoint,
                token,
                "Reply with exactly: AgriSystem AI connection OK.",
                # CPU model cold-start/generation can exceed the old 12s
                # timeout. The inference service itself remains protected by
                # its API key and request limits.
                timeout=180,
                max_new_tokens=24,
            )
            elapsed = round((time.time() - start_time) * 1000)
            return jsonify({
                "success": True,
                "message": f"Own AI endpoint connected ({elapsed}ms latency). Reply: {reply[:120]}",
                "latency_ms": elapsed,
            })
        except Exception as exc:  # noqa: BLE001
            elapsed = round((time.time() - start_time) * 1000)
            return jsonify({"success": False, "error": str(exc), "latency_ms": elapsed}), 200

@admin_bp.route("/api/generate_inference_key", methods=["POST"])
@login_required
@permission_required("manage_roles")
def generate_inference_key():
    """Generate a high-entropy shared secret for the model inference API."""
    return jsonify({"success": True, "api_key": secrets.token_urlsafe(32)})


@admin_bp.route("/api/fetch_provider_models", methods=["POST"])
@login_required
@permission_required("manage_roles")
def fetch_provider_models():
    data = request.get_json(silent=True) or request.form
    provider = (data.get("provider") or "own-ai").strip().lower()
    if provider not in {"own-ai", "trained-ai", "huggingface", "hf", "hugging_face"}:
        return jsonify({"success": False, "error": "Commercial LLM providers are disabled. Add your trained model under Trained Models."}), 410
    return jsonify({"success": False, "error": "Your trained endpoint is tested from the Trained Models panel."}), 410


@admin_bp.route("/translations/backups", methods=["GET"])
@translation_access_required
def translations_backups():
    backups = (
        TranslationBackup.query
        .order_by(TranslationBackup.created_at.desc())
        .limit(30)
        .all()
    )
    return render_react_page(
        bootstrap_payload=build_admin_translations_backups_bootstrap(backups=backups),
        title="Translation Backups",
    )


@admin_bp.route("/translations/undo", methods=["POST"])
@translation_access_required
def translations_undo():
    backup_id = request.form.get("backup_id")
    if backup_id:
        backup = TranslationBackup.query.get(int(backup_id))
    else:
        backup = (
            TranslationBackup.query
            .order_by(TranslationBackup.created_at.desc())
            .first()
        )
    if not backup:
        flash("No backup found to restore.", "warning")
        return redirect(url_for("admin.translations"))
    try:
        payload = json.loads(backup.payload)
    except Exception:  # noqa: BLE001
        flash("Backup is corrupted.", "danger")
        return redirect(url_for("admin.translations"))

    scope = payload.get("scope") or backup.scope
    restored = 0

    if scope == "crops":
        for item in payload.get("items", []):
            crop = Crop.query.get(item.get("id"))
            if not crop:
                continue
            crop.name_kh = item.get("name_kh")
            crop.description_kh = item.get("description_kh")
            restored += 1

    elif scope == "diseases":
        for item in payload.get("items", []):
            disease = Disease.query.get(item.get("id"))
            if not disease:
                continue
            disease.name_kh = item.get("name_kh")
            disease.description_kh = item.get("description_kh")
            disease.treatment_kh = item.get("treatment_kh")
            restored += 1

    elif scope == "symptoms":
        for item in payload.get("items", []):
            symptom = Symptom.query.get(item.get("id"))
            if not symptom:
                continue
            symptom.name_kh = item.get("name_kh")
            symptom.description_kh = item.get("description_kh")
            restored += 1

    else:
        for item in payload.get("crops", []):
            crop = Crop.query.get(item.get("id"))
            if not crop:
                continue
            crop.name_kh = item.get("name_kh")
            crop.description_kh = item.get("description_kh")
            restored += 1
        for item in payload.get("diseases", []):
            disease = Disease.query.get(item.get("id"))
            if not disease:
                continue
            disease.name_kh = item.get("name_kh")
            disease.description_kh = item.get("description_kh")
            disease.treatment_kh = item.get("treatment_kh")
            restored += 1
        for item in payload.get("symptoms", []):
            symptom = Symptom.query.get(item.get("id"))
            if not symptom:
                continue
            symptom.name_kh = item.get("name_kh")
            symptom.description_kh = item.get("description_kh")
            restored += 1

    db.session.commit()
    flash(f"Restored {restored} item(s) from backup.", "success")
    return redirect(url_for("admin.translations"))



# ==================================================
# USER MANAGEMENT
# ==================================================
@admin_bp.route("/users")
@login_required
@permission_required("manage_users")
def users():
    q = (request.args.get("q") or "").strip()
    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like)
            )
        )
    return render_react_page(
        bootstrap_payload=build_admin_users_bootstrap(
            users=query.order_by(User.created_at.desc()).all(),
            roles=Role.query.all(),
            q=q,
        ),
        title="User Management",
    )


@admin_bp.route("/users/<int:user_id>")
@login_required
@permission_required("manage_users")
def user_detail(user_id):
    q = (request.args.get("q") or "").strip()
    user = User.query.get_or_404(user_id)
    return render_react_page(
        bootstrap_payload=build_admin_user_detail_bootstrap(
            user=user,
            roles=Role.query.all(),
            q=q,
        ),
        title=user.full_name or user.username,
    )


# ==================================================
# BULK USER ACTIONS
# ==================================================
@admin_bp.route("/users/bulk", methods=["POST"])
@login_required
@permission_required("manage_users")
def users_bulk():
    action = (request.form.get("action") or "").strip().lower()
    scope = (request.form.get("scope") or "selected").strip().lower()
    q = (request.form.get("q") or "").strip()
    raw_ids = request.form.getlist("user_ids")
    user_ids = []
    for value in raw_ids:
        try:
            user_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    redirect_url = url_for("admin.users", q=q) if q else url_for("admin.users")

    if scope != "all" and not user_ids:
        flash("Select at least one user", "warning")
        return redirect(redirect_url)

    if action in ("export_csv", "export_json"):
        if scope == "all":
            query = User.query
            if q:
                like = f"%{q}%"
                query = query.filter(
                    or_(
                        User.username.ilike(like),
                        User.email.ilike(like),
                        User.full_name.ilike(like)
                    )
                )
            users = query.order_by(User.id.asc()).all()
        else:
            users = (
                User.query
                .filter(User.id.in_(user_ids))
                .order_by(User.id.asc())
                .all()
            )
        rows = [_user_row(user) for user in users]
        detail = (
            f"format={action.replace('export_', '')} scope={scope} "
            f"count={len(rows)} q={q or '-'}"
        )
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="USERS_EXPORT",
                detail=detail
            )
        )
        db.session.commit()
        filename_suffix = "all" if scope == "all" else "selected"
        if action == "export_json":
            payload = {
                "exported_at": _now_dt().isoformat(),
                "users": rows
            }
            return _json_response(payload, f"users_{filename_suffix}.json")
        fieldnames = ["id", "username", "email", "roles", "is_active", "created_at"]
        return _csv_response(rows, fieldnames, f"users_{filename_suffix}.csv")

    if action not in ("ban", "unban"):
        flash("Select a bulk action", "danger")
        return redirect(redirect_url)

    if scope == "all":
        query = User.query
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    User.username.ilike(like),
                    User.email.ilike(like),
                    User.full_name.ilike(like)
                )
            )
        users = query.order_by(User.id.asc()).all()
    else:
        users = (
            User.query
            .filter(User.id.in_(user_ids))
            .order_by(User.id.asc())
            .all()
        )

    desired_active = action == "unban"
    updated = 0
    skipped = 0
    unchanged = 0

    for user in users:
        if user.has_role("admin"):
            skipped += 1
            continue
        if user.is_active == desired_active:
            unchanged += 1
            continue
        user.is_active = desired_active
        updated += 1
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="UNBAN_USER" if desired_active else "BAN_USER",
                target_user=user.username,
                detail="bulk=true"
            )
        )

    db.session.commit()
    verb = "Unbanned" if desired_active else "Banned"
    message = f"{verb} {updated} user(s)."
    if unchanged:
        message += f" {unchanged} already {('active' if desired_active else 'banned')}."
    if skipped:
        message += f" Skipped {skipped} admin user(s)."
    flash(message, "warning")
    return redirect(redirect_url)


# ==================================================
# USERS EXPORT (FILTERED)
# ==================================================
@admin_bp.route("/users/export")
@login_required
@permission_required("manage_users")
def users_export():
    export_format = (request.args.get("format") or "csv").strip().lower()
    q = (request.args.get("q") or "").strip()

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.username.ilike(like),
                User.email.ilike(like),
                User.full_name.ilike(like)
            )
        )
    users = query.order_by(User.id.asc()).all()
    rows = [_user_row(user) for user in users]

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="USERS_EXPORT",
            detail=f"format={export_format} scope=all count={len(rows)} q={q or '-'}"
        )
    )
    db.session.commit()

    if export_format == "json":
        payload = {
            "exported_at": _now_dt().isoformat(),
            "users": rows
        }
        return _json_response(payload, "users_filtered.json")
    if export_format == "csv":
        fieldnames = ["id", "username", "email", "roles", "is_active", "created_at"]
        return _csv_response(rows, fieldnames, "users_filtered.csv")

    abort(400)


# ==================================================
# CREATE USER
# ==================================================
@admin_bp.route("/users/create", methods=["POST"])
@login_required
@permission_required("manage_users")
def create_user():
    username = request.form.get("username")
    password = request.form.get("password")
    role_name = request.form.get("role")
    full_name = (request.form.get("full_name") or "").strip()
    email_value = (request.form.get("email") or "").strip().lower()

    if not all([username, password, role_name]):
        flash("All fields are required.", "danger")
        return redirect(url_for("admin.users"))

    if User.query.filter_by(username=username).first():
        flash("Username already exists.", "danger")
        return redirect(url_for("admin.users"))

    if email_value and User.query.filter_by(email=email_value).first():
        flash("Email already exists.", "danger")
        return redirect(url_for("admin.users"))

    if full_name and len(full_name) > 120:
        flash("Full name is too long.", "danger")
        return redirect(url_for("admin.users"))

    role = Role.query.filter_by(name=role_name).first()
    if not role:
        flash("Invalid role.", "danger")
        return redirect(url_for("admin.users"))

    user = User(username=username)
    if full_name:
        user.full_name = full_name
    if email_value:
        user.email = email_value
    user.set_password(password)
    user.roles.append(role)

    db.session.add(user)
    db.session.flush()

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="CREATE_USER",
            target_user=username,
            detail=f"role={role_name}"
        )
    )

    db.session.commit()
    flash("User created successfully.", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# BAN / UNBAN USER
# ==================================================
@admin_bp.route("/users/<int:user_id>/toggle-status", methods=["POST"])
@login_required
@permission_required("manage_users")
def toggle_user_status(user_id):
    user = User.query.get_or_404(user_id)

    if user.has_role("admin"):
        flash("Cannot modify admin account.", "danger")
        return redirect(url_for("admin.users"))

    user.is_active = not user.is_active

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="UNBAN_USER" if user.is_active else "BAN_USER",
            target_user=user.username,
            detail=f"is_active={user.is_active}"
        )
    )

    db.session.commit()
    flash("User status updated.", "warning")
    return redirect(url_for("admin.users"))

@admin_bp.route("/users/<int:user_id>/toggle-premium", methods=["POST"])
@login_required
@permission_required("manage_users")
def toggle_user_premium(user_id):
    user = User.query.get_or_404(user_id)
    user.is_premium = not user.is_premium
    user.premium_expires_at = None
    
    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="TOGGLE_PREMIUM",
            target_user=user.username,
            detail=f"is_premium={user.is_premium}"
        )
    )
    db.session.commit()
    
    status_text = "Premium granted" if user.is_premium else "Premium revoked"
    flash(f"{status_text} for {user.username}.", "success")
    return redirect(request.referrer or url_for("admin.users"))

@admin_bp.route("/users/<int:user_id>/add-premium-time", methods=["POST"])
@login_required
@permission_required("manage_users")
def add_premium_time(user_id):
    user = User.query.get_or_404(user_id)
    try:
        amount = int(request.form.get("amount", 0))
    except ValueError:
        amount = 0
    unit = request.form.get("unit", "days")
    
    if amount > 0:
        user.is_premium = True
        
        # If lifetime, adding time turns it into a fixed expiration starting from now
        base_date = user.premium_expires_at if user.premium_expires_at and user.premium_expires_at > _now_dt() else _now_dt()
        
        if unit == "days":
            user.premium_expires_at = base_date + timedelta(days=amount)
        elif unit == "months":
            user.premium_expires_at = base_date + timedelta(days=amount * 30)
        elif unit == "years":
            user.premium_expires_at = base_date + timedelta(days=amount * 365)
            
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="ADD_PREMIUM_TIME",
                target_user=user.username,
                detail=f"Added {amount} {unit}"
            )
        )
        db.session.commit()
        flash(f"Added {amount} {unit} of Premium time to {user.username}.", "success")
    else:
        flash("Invalid amount.", "danger")
        
    return redirect(request.referrer or url_for("admin.users"))

@admin_bp.route("/users/<int:user_id>/update-credits", methods=["POST"])
@login_required
@permission_required("manage_users")
def update_user_credits(user_id):
    user = User.query.get_or_404(user_id)
    raw_credits = request.form.get("ai_credits", "").strip()
    try:
        new_credits = max(0, int(raw_credits))
    except (ValueError, TypeError):
        flash("Invalid token credits value.", "danger")
        return redirect(request.referrer or url_for("admin.users"))

    old_credits = user.ai_credits
    user.ai_credits = new_credits

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="UPDATE_USER_CREDITS",
            target_user=user.username,
            detail=f"ai_credits changed from {old_credits} to {new_credits}"
        )
    )
    db.session.commit()
    flash(f"Updated AI tokens for {user.username} to {new_credits:,}.", "success")
    return redirect(request.referrer or url_for("admin.users"))

# ==================================================
# CHANGE USER ROLE
# ==================================================
@admin_bp.route("/users/<int:user_id>/change-role", methods=["POST"])
@login_required
@permission_required("manage_users")
def change_user_role(user_id):
    user = User.query.get_or_404(user_id)
    
    if user.email == "iks214262@gmail.com":
        flash("Cannot change the role of the Super Admin.", "danger")
        return redirect(url_for("admin.users"))
        
    new_role_name = request.form.get("role")

    role = Role.query.filter_by(name=new_role_name).first()
    if not role:
        flash("Invalid role.", "danger")
        return redirect(url_for("admin.users"))

    old_roles = [r.name for r in user.roles]

    user.roles.clear()
    user.roles.append(role)

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="CHANGE_ROLE",
            target_user=user.username,
            detail=f"{old_roles} → {new_role_name}"
        )
    )

    db.session.commit()
    flash("Role updated.", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# RESET USER PASSWORD
# ==================================================
@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@login_required
@permission_required("manage_users")
def reset_user_password(user_id):
    user = User.query.get_or_404(user_id)

    if user.has_role("admin"):
        flash("Cannot change admin password here.", "danger")
        return redirect(url_for("admin.users"))

    new_password = request.form.get("new_password", "").strip()
    if not new_password or len(new_password) < 6:
        flash("Password must be at least 6 characters.", "danger")
        return redirect(url_for("admin.users"))

    user.set_password(new_password)

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="RESET_PASSWORD",
            target_user=user.username,
            detail="admin_reset=true"
        )
    )

    db.session.commit()
    flash("Password updated.", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# UPDATE USER EMAIL
# ==================================================
@admin_bp.route("/users/<int:user_id>/update-email", methods=["POST"])
@login_required
@permission_required("manage_users")
def update_user_email(user_id):
    user = User.query.get_or_404(user_id)
    new_email = (request.form.get("email") or "").strip().lower()

    if new_email:
        existing = (
            User.query
            .filter(User.email == new_email, User.id != user.id)
            .first()
        )
        if existing:
            flash("Email already exists.", "danger")
            return redirect(url_for("admin.users"))
    else:
        new_email = None

    user.email = new_email

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="UPDATE_EMAIL",
            target_user=user.username,
            detail=f"email={new_email or 'cleared'}"
        )
    )

    db.session.commit()
    flash("Email updated.", "success")
    return redirect(url_for("admin.users"))


# ==================================================
# ROLE LIST
# ==================================================
@admin_bp.route("/roles")
@login_required
@permission_required("manage_roles")
def roles():
    roles_list = Role.query.order_by(func.lower(Role.name).asc()).all()
    role_user_counts = dict(
        db.session.query(
            user_roles.c.role_id,
            func.count(user_roles.c.user_id)
        )
        .group_by(user_roles.c.role_id)
        .all()
    )

    return render_react_page(
        bootstrap_payload=build_admin_roles_bootstrap(
            roles=roles_list,
            core_role_names=CORE_ROLE_NAMES,
            role_user_counts=role_user_counts,
            total_permissions=Permission.query.count(),
        ),
        title="Role Management",
    )


# ==================================================
# CREATE ROLE
# ==================================================
@admin_bp.route("/roles/create", methods=["POST"])
@login_required
@permission_required("manage_roles")
def create_role():
    raw_role_name = (request.form.get("role_name") or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", raw_role_name)
    normalized = re.sub(r"_+", "_", normalized).strip("_")

    if not normalized:
        flash(t("role_name_required_msg"), "danger")
        return redirect(url_for("admin.roles"))

    if len(normalized) > 50:
        flash(t("role_name_length_msg"), "danger")
        return redirect(url_for("admin.roles"))

    if (not normalized.isascii()) or (not all(ch.isalnum() or ch == "_" for ch in normalized)):
        flash(t("role_name_invalid_msg"), "danger")
        return redirect(url_for("admin.roles"))

    existing_role = Role.query.filter(func.lower(Role.name) == normalized).first()
    if existing_role:
        flash(t("role_exists_msg"), "warning")
        return redirect(url_for("admin.roles"))

    base_route = request.form.get("route_type") or "farmer"
    if base_route not in ["admin", "expert", "farmer"]:
        base_route = "farmer"

    new_role = Role(name=normalized, route_type=base_route)
    db.session.add(new_role)
    
    # Auto-fill permissions by cloning from the base route's core role
    base_role = Role.query.filter_by(name=base_route).first()
    if base_role:
        for perm in base_role.permissions:
            new_role.permissions.append(perm)

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="CREATE_ROLE",
            target_user=normalized,
        )
    )

    try:
        db.session.commit()
        flash(t("role_created_msg"), "success")
    except IntegrityError:
        db.session.rollback()
        flash(t("role_create_failed_msg"), "danger")

    return redirect(url_for("admin.roles"))


# ==================================================
# DELETE ROLE
# ==================================================
@admin_bp.route("/roles/<int:role_id>/delete", methods=["POST"])
@login_required
@permission_required("manage_roles")
def delete_role(role_id):
    role = Role.query.get_or_404(role_id)
    role_name = (role.name or "").strip().lower()

    if role_name in CORE_ROLE_NAMES:
        flash(t("core_roles_cannot_delete_msg"), "danger")
        return redirect(url_for("admin.roles"))

    assigned_users_count = role.users.count()
    if assigned_users_count > 0:
        flash(t("role_in_use_delete_msg", role=role.name, count=assigned_users_count), "warning")
        return redirect(url_for("admin.roles"))

    try:
        role_label = role.name
        db.session.delete(role)
        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="DELETE_ROLE",
                target_user=role_label,
            )
        )
        db.session.commit()
        flash(t("role_deleted_msg"), "success")
    except Exception:  # noqa: BLE001
        db.session.rollback()
        flash(t("role_delete_failed_msg"), "danger")

    return redirect(url_for("admin.roles"))


# ==================================================
# ROLE PERMISSIONS (PROTECTED)
# ==================================================
@admin_bp.route("/roles/<int:role_id>/permissions", methods=["GET", "POST"])
@login_required
@permission_required("manage_roles")
def manage_role_permissions(role_id):
    role = Role.query.get_or_404(role_id)
    permissions = Permission.query.order_by(func.lower(Permission.code).asc()).all()

    if request.method == "POST":
        role.permissions.clear()

        for pid in request.form.getlist("permissions"):
            perm = Permission.query.get(int(pid))
            if perm:
                role.permissions.append(perm)

        # 🔐 FORCE CORE ADMIN PERMISSIONS
        if role.name == "admin":
            required = ["view_dashboard", "manage_users", "manage_roles"]
            for code in required:
                perm = Permission.query.filter_by(code=code).first()
                if perm and perm not in role.permissions:
                    role.permissions.append(perm)

        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="UPDATE_ROLE_PERMISSIONS",
                target_user=role.name
            )
        )

        db.session.commit()
        flash("Permissions updated.", "success")
        return redirect(url_for("admin.roles"))

    grouped_permissions = {}
    for perm in permissions:
        c = perm.code.lower()
        if "dashboard" in c: group = "Dashboard"
        elif "user" in c: group = "User Management"
        elif "role" in c or "permission" in c: group = "Roles & Access"
        elif "crop" in c: group = "Agriculture (Crops)"
        elif "disease" in c: group = "Agriculture (Diseases)"
        elif "diagnos" in c: group = "Diagnosis System"
        elif "chat" in c: group = "Expert Chat & Communication"
        elif "report" in c: group = "Reports & Analytics"
        elif "setting" in c or "system" in c: group = "System Configuration"
        else:
            parts = c.split('_', 1)
            group = parts[1].replace('_', ' ').title() if len(parts) > 1 else "General Operations"

        if group not in grouped_permissions:
            grouped_permissions[group] = []
        grouped_permissions[group].append(perm)

    all_roles = Role.query.order_by(func.lower(Role.name).asc()).all()
    return render_react_page(
        bootstrap_payload=build_admin_role_permissions_bootstrap(
            role=role,
            permissions=permissions,
            grouped_permissions=grouped_permissions,
            core_role_names=CORE_ROLE_NAMES,
            all_roles=all_roles,
        ),
        title=f"Permissions: {role.name}",
    )


# ==================================================
# 🔍 AUDIT LOGS
# ==================================================
def _audit_failure_clause():
    return or_(
        AuditLog.action.ilike("%FAILURE%"),
        AuditLog.action.ilike("%ERROR%"),
        AuditLog.action == "BAN_USER",
        AuditLog.action == "AUTH_SESSION_EXPIRED",
    )


def _audit_logs_filtered_query(*, q: str = "", action_filter: str = ""):
    query = AuditLog.query.outerjoin(User, AuditLog.user_id == User.id)
    if action_filter:
        query = query.filter(AuditLog.action == action_filter)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                AuditLog.action.ilike(like),
                AuditLog.target_user.ilike(like),
                AuditLog.detail.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
            )
        )
    return query


@admin_bp.route("/audit-logs")
@login_required
@permission_required("view_dashboard")
def audit_logs():
    q = (request.args.get("q") or "").strip()
    action_filter = (request.args.get("action") or "").strip()

    logs = (
        _audit_logs_filtered_query(q=q, action_filter=action_filter)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(250)
        .all()
    )

    total_count = AuditLog.query.count()
    since_24h = _now_dt() - timedelta(hours=24)
    last_24h_count = AuditLog.query.filter(AuditLog.created_at >= since_24h).count()
    failure_count = AuditLog.query.filter(_audit_failure_clause()).count()
    unique_actors = (
        db.session.query(func.count(func.distinct(AuditLog.user_id)))
        .filter(AuditLog.user_id.isnot(None))
        .scalar()
        or 0
    )
    available_actions = [
        row[0]
        for row in (
            AuditLog.query.with_entities(AuditLog.action)
            .distinct()
            .order_by(AuditLog.action.asc())
            .all()
        )
        if row[0]
    ]

    return render_react_page(
        bootstrap_payload=build_admin_audit_logs_bootstrap(
            logs=logs,
            q=q,
            action_filter=action_filter,
            total_count=total_count,
            last_24h_count=last_24h_count,
            failure_count=failure_count,
            unique_actors=unique_actors,
            available_actions=available_actions,
        ),
        title="Audit Logs",
    )


@admin_bp.route("/audit-logs/export")
@login_required
@permission_required("view_dashboard")
def audit_logs_export():
    export_format = (request.args.get("format") or "csv").strip().lower()
    if export_format not in {"csv", "json"}:
        abort(400)

    q = (request.args.get("q") or "").strip()
    action_filter = (request.args.get("action") or "").strip()

    logs = (
        _audit_logs_filtered_query(q=q, action_filter=action_filter)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(5000)
        .all()
    )

    rows = [
        {
            "id": log.id,
            "action": log.action or "",
            "actor": getattr(getattr(log, "user", None), "username", None) or "System",
            "target": log.target_user or "",
            "detail": log.detail or "",
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]

    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="AUDIT_LOGS_EXPORT",
            detail=f"format={export_format} count={len(rows)} q={q or '-'} action={action_filter or '-'}",
        )
    )
    db.session.commit()

    def _csv_safe(value):
        text = "" if value is None else str(value)
        if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
            return f"'{text}"
        return text

    if export_format == "json":
        return _json_response(
            {"exported_at": _now_dt().isoformat(), "logs": rows},
            "audit_logs.json",
        )
    safe_csv_rows = [
        {k: _csv_safe(v) if isinstance(v, str) else v for k, v in row.items()}
        for row in rows
    ]
    return _csv_response(
        safe_csv_rows,
        ["id", "action", "actor", "target", "detail", "created_at"],
        "audit_logs.csv",
    )


# ==================================================
# 🛟 SUPPORT REQUESTS (AI Helper "Contact Admin")
# ==================================================
@admin_bp.route("/support-requests")
@login_required
@permission_required("view_dashboard")
def support_requests():
    filter_status = (request.args.get("status") or "open").strip().lower()
    if filter_status not in {"open", "resolved", "all"}:
        filter_status = "open"

    q = (request.args.get("q") or "").strip()

    query = SupportRequest.query.join(User, SupportRequest.requester_id == User.id)
    if filter_status in {"open", "resolved"}:
        query = query.filter(SupportRequest.status == filter_status)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                SupportRequest.message.ilike(like),
                SupportRequest.page.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
            )
        )

    support_requests = (
        query
        .order_by(SupportRequest.created_at.desc())
        .limit(250)
        .all()
    )

    open_count = SupportRequest.query.filter_by(status="open").count()
    resolved_count = SupportRequest.query.filter_by(status="resolved").count()
    total_count = SupportRequest.query.count()

    users = User.query.order_by(User.username.asc()).limit(100).all()

    return render_react_page(
        bootstrap_payload=build_admin_support_requests_bootstrap(
            support_requests=support_requests,
            filter_status=filter_status,
            q=q,
            open_count=open_count,
            resolved_count=resolved_count,
            total_count=total_count,
            users=users,
        ),
        title="Support Requests",
    )


@admin_bp.route("/support-requests/create", methods=["POST"])
@login_required
@permission_required("view_dashboard")
def create_support_request():
    user_id = request.form.get("requester_id")
    message = request.form.get("message", "").strip()
    page = request.form.get("page", "").strip()

    if not message:
        flash("Inquiry message cannot be empty.", "danger")
        return redirect(url_for("admin.support_requests"))

    requester = User.query.get(user_id) if user_id else current_user
    if not requester:
        requester = current_user

    role_label = "admin"
    if hasattr(requester, "has_role"):
        if requester.has_role("farmer"):
            role_label = "farmer"
        elif requester.has_role("expert"):
            role_label = "expert"

    req = SupportRequest(
        requester_id=requester.id,
        requester_role=role_label,
        message=message,
        page=page or "/admin/support-requests",
        user_agent=(request.headers.get("User-Agent") or "Admin Direct Ticket")[:255],
        status="open"
    )
    db.session.add(req)
    db.session.commit()
    flash(f"Support inquiry ticket #{req.id} created successfully!", "success")
    return redirect(url_for("admin.support_requests"))



@admin_bp.route("/support-requests/<int:req_id>/resolve", methods=["POST"])
@login_required
@permission_required("view_dashboard")
def resolve_support_request(req_id):
    req = SupportRequest.query.get_or_404(req_id)

    if req.status == "resolved":
        flash("Support request is already resolved.", "info")
    else:
        req.status = "resolved"
        req.resolved_at = _now_dt()
        req.resolved_by_id = current_user.id

        try:
            db.session.commit()
            flash(f"Support request #{req.id} marked as resolved successfully!", "success")
        except Exception:  # noqa: BLE001
            db.session.rollback()
            flash("Unable to update support request status. Please try again.", "danger")
            return redirect(url_for("admin.support_requests"))

        # Notify requester (best-effort; isolated transaction)
        try:
            notify_user(
                user_id=req.requester_id,
                kind="support_request_resolved",
                title="Support request resolved",
                subtitle=_snippet(req.message),
                url=req.page or None,
                icon="fas fa-life-ring",
                level="success",
                source_id=req.id,
            )
            db.session.commit()
        except Exception:  # noqa: BLE001
            db.session.rollback()

    next_status = (request.form.get("status") or "open").strip().lower()
    next_q = (request.form.get("q") or "").strip()
    if next_status not in {"open", "resolved", "all"}:
        next_status = "open"
    return redirect(url_for("admin.support_requests", status=next_status, q=next_q))



@admin_bp.route("/support-requests/<int:req_id>/reopen", methods=["POST"])
@login_required
@permission_required("view_dashboard")
def reopen_support_request(req_id):
    req = SupportRequest.query.get_or_404(req_id)
    req.status = "open"
    req.resolved_at = None
    req.resolved_by_id = None
    db.session.commit()
    flash("Support request reopened.", "info")
    next_status = (request.form.get("status") or "all").strip().lower()
    next_q = (request.form.get("q") or "").strip()
    return redirect(url_for("admin.support_requests", status=next_status, q=next_q))


@admin_bp.route("/support-requests/<int:req_id>/delete", methods=["POST"])
@login_required
@permission_required("view_dashboard")
def delete_support_request(req_id):
    req = SupportRequest.query.get_or_404(req_id)
    db.session.delete(req)
    db.session.commit()
    flash("Support request deleted successfully.", "success")
    next_status = (request.form.get("status") or "all").strip().lower()
    next_q = (request.form.get("q") or "").strip()
    return redirect(url_for("admin.support_requests", status=next_status, q=next_q))




@admin_bp.route("/promo-codes", methods=["GET", "POST"])
@login_required
@permission_required("manage_users")
def promo_codes():
    if request.method == "POST":
        raw_tokens = request.form.get("tokens", type=int, default=1000)
        tokens = max(1, int(raw_tokens or 1000))
        quantity = min(20, max(1, int(request.form.get("quantity", type=int, default=1) or 1)))
        custom_code = re.sub(r"[^A-Z0-9_-]", "", (request.form.get("custom_code") or "").strip().upper())

        if custom_code and quantity == 1:
            if len(custom_code) < 3 or len(custom_code) > 32:
                flash("Custom voucher code must be between 3 and 32 characters.", "danger")
                return redirect(url_for("admin.promo_codes"))
            if PromoCode.query.filter(func.upper(PromoCode.code) == custom_code).first():
                flash(f"Voucher code '{custom_code}' already exists.", "warning")
                return redirect(url_for("admin.promo_codes"))
            generated_codes = [custom_code]
        else:
            alphabet = string.ascii_uppercase + string.digits
            generated_codes = []
            while len(generated_codes) < quantity:
                candidate = "".join(secrets.choice(alphabet) for _ in range(8))
                if candidate in generated_codes:
                    continue
                if not PromoCode.query.filter(func.upper(PromoCode.code) == candidate).first():
                    generated_codes.append(candidate)

        for code in generated_codes:
            db.session.add(PromoCode(code=code, tokens_reward=tokens))

        db.session.add(
            AuditLog(
                user_id=current_user.id,
                action="MINT_PROMO_CODE",
                detail=f"count={len(generated_codes)} tokens={tokens} codes={','.join(generated_codes)}",
            )
        )
        db.session.commit()

        if len(generated_codes) == 1:
            flash(f"Created new reward code: {generated_codes[0]}", "success")
        else:
            flash(f"Minted {len(generated_codes)} reward codes ({tokens:,} credits each).", "success")
        return redirect(url_for("admin.promo_codes"))

    codes = PromoCode.query.order_by(PromoCode.created_at.desc(), PromoCode.id.desc()).all()
    return render_react_page(
        bootstrap_payload=build_admin_promo_codes_bootstrap(codes=codes),
        title="Promo Codes",
    )


@admin_bp.route("/promo-codes/<int:code_id>/delete", methods=["POST"])
@login_required
@permission_required("manage_users")
def delete_promo_code(code_id):
    promo = PromoCode.query.get_or_404(code_id)
    code_label = promo.code
    db.session.delete(promo)
    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="DELETE_PROMO_CODE",
            target_user=code_label,
        )
    )
    db.session.commit()
    flash("Reward code deleted.", "info")
    return redirect(url_for("admin.promo_codes"))


@admin_bp.route("/promo-codes/bulk", methods=["POST"])
@login_required
@permission_required("manage_users")
def promo_codes_bulk():
    action = (request.form.get("action") or "").strip().lower()
    if action not in {"delete_selected", "clear_redeemed"}:
        flash("Select a valid bulk action.", "danger")
        return redirect(url_for("admin.promo_codes"))

    if action == "clear_redeemed":
        targets = PromoCode.query.filter_by(is_used=True).all()
    else:
        raw_ids = request.form.getlist("code_ids")
        code_ids = [int(x) for x in raw_ids if str(x).isdigit()]
        if not code_ids:
            flash("Select at least one reward code.", "warning")
            return redirect(url_for("admin.promo_codes"))
        targets = PromoCode.query.filter(PromoCode.id.in_(code_ids)).all()

    if not targets:
        flash("No matching reward codes to remove.", "info")
        return redirect(url_for("admin.promo_codes"))

    deleted_codes = [p.code for p in targets]
    for item in targets:
        db.session.delete(item)
    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action="BULK_DELETE_PROMO_CODES",
            detail=f"action={action} count={len(deleted_codes)}",
        )
    )
    db.session.commit()
    flash(f"Removed {len(deleted_codes)} reward code(s).", "info")
    return redirect(url_for("admin.promo_codes"))
