import csv
import json
from datetime import datetime
from decimal import Decimal
from io import StringIO

from flask import render_template, request, redirect, url_for, flash, Response, abort
from flask_login import current_user
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.utils.decorators import role_required

from app.models.audit_log import AuditLog
from app.models.symptom import Symptom
from app.models.rule import Rule
from app.models.disease import Disease
from app.models.mixed_agri_source import MixedAgriSource
from app.models.mixed_agri_fact import MixedAgriFact

from . import expert_bp


def _parse_int(value, field_name):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a number") from exc


def _parse_decimal(value, field_name):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return Decimal(value)
    except Exception as exc:
        raise ValueError(f"{field_name} must be a number") from exc


def _parse_date(value, field_name):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a valid date") from exc


def _clamp_per_page(per_page):
    if per_page < 5:
        return 5
    if per_page > 100:
        return 100
    return per_page


def _paginate(query, page, per_page):
    total = query.order_by(None).count()
    pages = max(1, (total + per_page - 1) // per_page) if total else 1
    page = max(1, min(page, pages))

    items = (
        query
        .limit(per_page)
        .offset((page - 1) * per_page)
        .all()
    )

    start = (page - 1) * per_page + 1 if total else 0
    end = start + len(items) - 1 if total else 0

    return items, {
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": pages,
        "start": start,
        "end": end,
        "has_prev": page > 1,
        "has_next": page < pages,
    }


def _current_path():
    full_path = request.full_path
    if full_path.endswith("?"):
        return full_path[:-1]
    return full_path


def _safe_next_url(default_url):
    next_url = request.form.get("next")
    if next_url and next_url.startswith("/"):
        return next_url
    return default_url


def _log_action(action, target=None, detail=None):
    if not current_user.is_authenticated:
        return
    if detail is not None and len(detail) > 250:
        detail = detail[:250]
    db.session.add(
        AuditLog(
            user_id=current_user.id,
            action=action,
            target_user=target,
            detail=detail
        )
    )


def _source_row(source):
    return {
        "id": source.id,
        "source_title": source.source_title,
        "source_org": source.source_org,
        "publication_year": source.publication_year,
        "source_type": source.source_type,
        "source_url": source.source_url,
        "accessed_at": source.accessed_at.isoformat() if source.accessed_at else None,
    }


def _fact_row(fact):
    return {
        "id": fact.id,
        "source_id": fact.source_id,
        "source_title": fact.source.source_title if fact.source else None,
        "source_org": fact.source.source_org if fact.source else None,
        "topic": fact.topic,
        "region": fact.region,
        "fact_text": fact.fact_text,
        "metric_value": float(fact.metric_value) if fact.metric_value is not None else None,
        "metric_unit": fact.metric_unit,
        "metric_year": fact.metric_year,
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


# ===============================
# Knowledge Dashboard
# ===============================
@expert_bp.route("/knowledge")
@role_required("expert")
def knowledge_dashboard():

    symptom_count = Symptom.query.count()
    rule_count = Rule.query.count()
    disease_count = Disease.query.count()
    mixed_source_count = MixedAgriSource.query.count()
    mixed_fact_count = MixedAgriFact.query.count()

    rules = Rule.query.order_by(Rule.id.desc()).all()

    return render_template(
        "expert/knowledge/dashboard.html",
        symptom_count=symptom_count,
        rule_count=rule_count,
        disease_count=disease_count,
        mixed_source_count=mixed_source_count,
        mixed_fact_count=mixed_fact_count,
        rules=rules
    )


# ===============================
# Create Symptom
# ===============================
@expert_bp.route("/knowledge/symptoms", methods=["GET", "POST"])
@role_required("expert")
def create_symptom():

    if request.method == "POST":
        name = request.form.get("name")
        name_kh = request.form.get("name_kh")
        description = request.form.get("description")
        description_kh = request.form.get("description_kh")

        if not name:
            flash("Symptom name required", "danger")
            return redirect(request.url)

        exists = Symptom.query.filter(
            func.lower(Symptom.name) == name.lower()
        ).first()

        if exists:
            flash("Symptom already exists", "warning")
            return redirect(request.url)

        db.session.add(
            Symptom(
                name=name,
                name_kh=name_kh,
                description=description,
                description_kh=description_kh
            )
        )
        db.session.commit()

        flash("Symptom added", "success")
        return redirect(url_for("expert.knowledge_dashboard"))

    return render_template("expert/knowledge/create_symptom.html")


# ===============================
# Create Rule
# ===============================
@expert_bp.route("/knowledge/rules", methods=["GET", "POST"])
@role_required("expert")
def create_rule():

    symptoms = Symptom.query.order_by(Symptom.name.asc()).all()
    diseases = Disease.query.order_by(Disease.name.asc()).all()

    if request.method == "POST":
        name = request.form.get("name")
        disease_id = request.form.get("disease_id")
        symptom_ids = request.form.getlist("symptoms")
        confidence = request.form.get("confidence")

        if not name or not disease_id or not symptom_ids:
            flash("Rule name, disease and symptoms required", "danger")
            return redirect(request.url)

        rule = Rule(
            name=name,
            disease_id=disease_id,
            confidence=float(confidence or 0)
        )

        db.session.add(rule)
        db.session.flush()

        for sid in symptom_ids:
            db.session.execute(
                "INSERT INTO rule_symptoms (rule_id, symptom_id) VALUES (:r, :s)",
                {"r": rule.id, "s": sid}
            )

        db.session.commit()

        flash("Rule created", "success")
        return redirect(url_for("expert.knowledge_dashboard"))

    return render_template(
        "expert/knowledge/create_rule.html",
        symptoms=symptoms,
        diseases=diseases
    )


# ===============================
# Mixed Agriculture Dashboard
# ===============================
@expert_bp.route("/knowledge/mixed-agri")
@role_required("expert")
def mixed_agri_dashboard():
    source_count = MixedAgriSource.query.count()
    fact_count = MixedAgriFact.query.count()
    page = request.args.get("page", 1, type=int)
    per_page = _clamp_per_page(request.args.get("per_page", 10, type=int))

    query = (
        MixedAgriFact.query
        .options(selectinload(MixedAgriFact.source))
        .order_by(MixedAgriFact.id.desc())
    )
    facts, pagination = _paginate(query, page, per_page)

    return render_template(
        "expert/knowledge/mixed_agri_dashboard.html",
        source_count=source_count,
        fact_count=fact_count,
        facts=facts,
        pagination=pagination
    )


# ===============================
# Mixed Agriculture Sources
# ===============================
@expert_bp.route("/knowledge/mixed-agri/sources")
@role_required("expert")
def mixed_agri_sources():
    q = (request.args.get("q") or "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = _clamp_per_page(request.args.get("per_page", 25, type=int))

    query = (
        MixedAgriSource.query
        .options(selectinload(MixedAgriSource.facts))
        .order_by(MixedAgriSource.id.desc())
    )

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                MixedAgriSource.source_title.ilike(like),
                MixedAgriSource.source_org.ilike(like),
                MixedAgriSource.source_type.ilike(like),
                MixedAgriSource.source_url.ilike(like)
            )
        )

    sources, pagination = _paginate(query, page, per_page)

    return render_template(
        "expert/knowledge/mixed_agri_sources.html",
        sources=sources,
        q=q,
        pagination=pagination,
        current_path=_current_path()
    )


@expert_bp.route("/knowledge/mixed-agri/sources/export")
@role_required("expert")
def mixed_agri_sources_export():
    q = (request.args.get("q") or "").strip()
    export_format = (request.args.get("format") or "csv").lower()

    query = (
        MixedAgriSource.query
        .order_by(MixedAgriSource.id.asc())
    )

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                MixedAgriSource.source_title.ilike(like),
                MixedAgriSource.source_org.ilike(like),
                MixedAgriSource.source_type.ilike(like),
                MixedAgriSource.source_url.ilike(like)
            )
        )

    sources = query.all()
    rows = [_source_row(source) for source in sources]

    if export_format == "json":
        payload = {
            "exported_at": datetime.utcnow().isoformat(),
            "sources": rows
        }
        _log_action(
            "MIXED_AGRI_SOURCE_EXPORT",
            detail=f"format=json count={len(rows)} q={q or '-'}"
        )
        db.session.commit()
        return _json_response(payload, "mixed_agri_sources.json")

    if export_format == "csv":
        fieldnames = [
            "id",
            "source_title",
            "source_org",
            "publication_year",
            "source_type",
            "source_url",
            "accessed_at",
        ]
        _log_action(
            "MIXED_AGRI_SOURCE_EXPORT",
            detail=f"format=csv count={len(rows)} q={q or '-'}"
        )
        db.session.commit()
        return _csv_response(rows, fieldnames, "mixed_agri_sources.csv")

    abort(400)


@expert_bp.route("/knowledge/mixed-agri/sources/bulk", methods=["POST"])
@role_required("expert")
def mixed_agri_sources_bulk():
    action = (request.form.get("action") or "").strip().lower()
    scope = (request.form.get("scope") or "selected").strip().lower()
    q = (request.form.get("q") or "").strip()
    raw_ids = request.form.getlist("source_ids")
    source_ids = []
    for value in raw_ids:
        try:
            source_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    if scope != "all" and not source_ids:
        flash("Select at least one source", "warning")
        return redirect(_safe_next_url(url_for("expert.mixed_agri_sources")))

    if action in ("export_csv", "export_json"):
        if scope == "all":
            query = MixedAgriSource.query.order_by(MixedAgriSource.id.asc())
            if q:
                like = f"%{q}%"
                query = query.filter(
                    or_(
                        MixedAgriSource.source_title.ilike(like),
                        MixedAgriSource.source_org.ilike(like),
                        MixedAgriSource.source_type.ilike(like),
                        MixedAgriSource.source_url.ilike(like)
                    )
                )
            sources = query.all()
        else:
            sources = (
                MixedAgriSource.query
                .filter(MixedAgriSource.id.in_(source_ids))
                .order_by(MixedAgriSource.id.asc())
                .all()
            )
        rows = [_source_row(source) for source in sources]
        if action == "export_json":
            payload = {
                "exported_at": datetime.utcnow().isoformat(),
                "sources": rows
            }
            _log_action(
                "MIXED_AGRI_SOURCE_EXPORT",
                detail=(
                    f"format=json scope={scope} count={len(rows)} "
                    f"q={q or '-'}"
                )
            )
            db.session.commit()
            return _json_response(payload, "mixed_agri_sources_selected.json")
        fieldnames = [
            "id",
            "source_title",
            "source_org",
            "publication_year",
            "source_type",
            "source_url",
            "accessed_at",
        ]
        _log_action(
            "MIXED_AGRI_SOURCE_EXPORT",
            detail=(
                f"format=csv scope={scope} count={len(rows)} "
                f"q={q or '-'}"
            )
        )
        db.session.commit()
        return _csv_response(rows, fieldnames, "mixed_agri_sources_selected.csv")

    if action != "delete":
        flash("Select a valid bulk action", "danger")
        return redirect(_safe_next_url(url_for("expert.mixed_agri_sources")))

    if scope == "all":
        query = MixedAgriSource.query
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    MixedAgriSource.source_title.ilike(like),
                    MixedAgriSource.source_org.ilike(like),
                    MixedAgriSource.source_type.ilike(like),
                    MixedAgriSource.source_url.ilike(like)
                )
            )
        deleted_count = query.delete(synchronize_session=False)
        detail = f"scope=all count={deleted_count} q={q or '-'}"
    else:
        deleted_count = (
            MixedAgriSource.query
            .filter(MixedAgriSource.id.in_(source_ids))
            .delete(synchronize_session=False)
        )
        ids_preview = ",".join(str(item) for item in source_ids[:25])
        detail = f"scope=selected count={deleted_count} ids={ids_preview}"
    _log_action("MIXED_AGRI_SOURCE_BULK_DELETE", detail=detail)

    db.session.commit()
    flash(f"Deleted {deleted_count} source(s)", "warning")
    return redirect(_safe_next_url(url_for("expert.mixed_agri_sources")))


@expert_bp.route("/knowledge/mixed-agri/sources/new", methods=["GET", "POST"])
@role_required("expert")
def mixed_agri_source_create():
    if request.method == "POST":
        source_title = (request.form.get("source_title") or "").strip()
        source_org = (request.form.get("source_org") or "").strip()
        source_type = (request.form.get("source_type") or "").strip() or None
        source_url = (request.form.get("source_url") or "").strip() or None
        accessed_raw = request.form.get("accessed_at")

        if not source_title or not source_org:
            flash("Source title and organization are required", "danger")
            return redirect(request.url)

        try:
            publication_year = _parse_int(
                request.form.get("publication_year"),
                "Publication year"
            )
            accessed_at = _parse_date(accessed_raw, "Accessed date")
        except ValueError as exc:
            flash(str(exc), "danger")
            return redirect(request.url)

        if not accessed_at:
            flash("Accessed date is required", "danger")
            return redirect(request.url)

        if source_url:
            exists = MixedAgriSource.query.filter(
                MixedAgriSource.source_url == source_url
            ).first()
            if exists:
                flash("Source URL already exists", "danger")
                return redirect(request.url)

        source = MixedAgriSource(
            source_title=source_title,
            source_org=source_org,
            publication_year=publication_year,
            source_type=source_type,
            source_url=source_url,
            accessed_at=accessed_at
        )

        try:
            db.session.add(source)
            db.session.flush()
            _log_action(
                "MIXED_AGRI_SOURCE_CREATE",
                target=f"source:{source.id}",
                detail=source.source_title
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("Source URL already exists", "danger")
            return redirect(request.url)

        flash("Source added", "success")
        return redirect(url_for("expert.mixed_agri_sources"))

    return render_template(
        "expert/knowledge/mixed_agri_source_form.html",
        source=None,
        is_edit=False
    )


@expert_bp.route("/knowledge/mixed-agri/sources/<int:source_id>/edit", methods=["GET", "POST"])
@role_required("expert")
def mixed_agri_source_edit(source_id):
    source = MixedAgriSource.query.get_or_404(source_id)

    if request.method == "POST":
        source_title = (request.form.get("source_title") or "").strip()
        source_org = (request.form.get("source_org") or "").strip()
        source_type = (request.form.get("source_type") or "").strip() or None
        source_url = (request.form.get("source_url") or "").strip() or None
        accessed_raw = request.form.get("accessed_at")

        if not source_title or not source_org:
            flash("Source title and organization are required", "danger")
            return redirect(request.url)

        try:
            publication_year = _parse_int(
                request.form.get("publication_year"),
                "Publication year"
            )
            accessed_at = _parse_date(accessed_raw, "Accessed date")
        except ValueError as exc:
            flash(str(exc), "danger")
            return redirect(request.url)

        if not accessed_at:
            flash("Accessed date is required", "danger")
            return redirect(request.url)

        if source_url:
            exists = (
                MixedAgriSource.query
                .filter(MixedAgriSource.source_url == source_url)
                .filter(MixedAgriSource.id != source.id)
                .first()
            )
            if exists:
                flash("Source URL already exists", "danger")
                return redirect(request.url)

        source.source_title = source_title
        source.source_org = source_org
        source.publication_year = publication_year
        source.source_type = source_type
        source.source_url = source_url
        source.accessed_at = accessed_at

        try:
            _log_action(
                "MIXED_AGRI_SOURCE_UPDATE",
                target=f"source:{source.id}",
                detail=source.source_title
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("Source URL already exists", "danger")
            return redirect(request.url)

        flash("Source updated", "success")
        return redirect(url_for("expert.mixed_agri_sources"))

    return render_template(
        "expert/knowledge/mixed_agri_source_form.html",
        source=source,
        is_edit=True
    )


@expert_bp.route("/knowledge/mixed-agri/sources/<int:source_id>/delete", methods=["POST"])
@role_required("expert")
def mixed_agri_source_delete(source_id):
    source = MixedAgriSource.query.get_or_404(source_id)
    _log_action(
        "MIXED_AGRI_SOURCE_DELETE",
        target=f"source:{source.id}",
        detail=source.source_title
    )
    db.session.delete(source)
    db.session.commit()
    flash("Source deleted", "warning")
    return redirect(url_for("expert.mixed_agri_sources"))


# ===============================
# Mixed Agriculture Facts
# ===============================
@expert_bp.route("/knowledge/mixed-agri/facts")
@role_required("expert")
def mixed_agri_facts():
    q = (request.args.get("q") or "").strip()
    source_id = request.args.get("source_id", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = _clamp_per_page(request.args.get("per_page", 25, type=int))

    query = (
        MixedAgriFact.query
        .join(MixedAgriSource)
        .options(selectinload(MixedAgriFact.source))
        .order_by(MixedAgriFact.id.desc())
    )

    if source_id:
        query = query.filter(MixedAgriFact.source_id == source_id)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                MixedAgriFact.fact_text.ilike(like),
                MixedAgriFact.topic.ilike(like),
                MixedAgriFact.region.ilike(like),
                MixedAgriSource.source_title.ilike(like)
            )
        )

    facts, pagination = _paginate(query, page, per_page)
    sources = MixedAgriSource.query.order_by(MixedAgriSource.source_title.asc()).all()

    return render_template(
        "expert/knowledge/mixed_agri_facts.html",
        facts=facts,
        sources=sources,
        q=q,
        source_id=source_id,
        pagination=pagination,
        current_path=_current_path()
    )


@expert_bp.route("/knowledge/mixed-agri/facts/export")
@role_required("expert")
def mixed_agri_facts_export():
    q = (request.args.get("q") or "").strip()
    source_id = request.args.get("source_id", type=int)
    export_format = (request.args.get("format") or "csv").lower()

    query = (
        MixedAgriFact.query
        .join(MixedAgriSource)
        .options(selectinload(MixedAgriFact.source))
        .order_by(MixedAgriFact.id.asc())
    )

    if source_id:
        query = query.filter(MixedAgriFact.source_id == source_id)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                MixedAgriFact.fact_text.ilike(like),
                MixedAgriFact.topic.ilike(like),
                MixedAgriFact.region.ilike(like),
                MixedAgriSource.source_title.ilike(like)
            )
        )

    facts = query.all()
    rows = [_fact_row(fact) for fact in facts]

    if export_format == "json":
        payload = {
            "exported_at": datetime.utcnow().isoformat(),
            "facts": rows
        }
        _log_action(
            "MIXED_AGRI_FACT_EXPORT",
            detail=(
                f"format=json count={len(rows)} "
                f"q={q or '-'} source_id={source_id or '-'}"
            )
        )
        db.session.commit()
        return _json_response(payload, "mixed_agri_facts.json")

    if export_format == "csv":
        fieldnames = [
            "id",
            "source_id",
            "source_title",
            "source_org",
            "topic",
            "region",
            "fact_text",
            "metric_value",
            "metric_unit",
            "metric_year",
        ]
        _log_action(
            "MIXED_AGRI_FACT_EXPORT",
            detail=(
                f"format=csv count={len(rows)} "
                f"q={q or '-'} source_id={source_id or '-'}"
            )
        )
        db.session.commit()
        return _csv_response(rows, fieldnames, "mixed_agri_facts.csv")

    abort(400)


@expert_bp.route("/knowledge/mixed-agri/facts/bulk", methods=["POST"])
@role_required("expert")
def mixed_agri_facts_bulk():
    action = (request.form.get("action") or "").strip().lower()
    scope = (request.form.get("scope") or "selected").strip().lower()
    q = (request.form.get("q") or "").strip()
    source_id = request.form.get("source_id", type=int)
    raw_ids = request.form.getlist("fact_ids")
    fact_ids = []
    for value in raw_ids:
        try:
            fact_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    if scope != "all" and not fact_ids:
        flash("Select at least one fact", "warning")
        return redirect(_safe_next_url(url_for("expert.mixed_agri_facts")))

    if action in ("export_csv", "export_json"):
        if scope == "all":
            query = (
                MixedAgriFact.query
                .join(MixedAgriSource)
                .options(selectinload(MixedAgriFact.source))
                .order_by(MixedAgriFact.id.asc())
            )
            if source_id:
                query = query.filter(MixedAgriFact.source_id == int(source_id))
            if q:
                like = f"%{q}%"
                query = query.filter(
                    or_(
                        MixedAgriFact.fact_text.ilike(like),
                        MixedAgriFact.topic.ilike(like),
                        MixedAgriFact.region.ilike(like),
                        MixedAgriSource.source_title.ilike(like)
                    )
                )
            facts = query.all()
        else:
            facts = (
                MixedAgriFact.query
                .join(MixedAgriSource)
                .options(selectinload(MixedAgriFact.source))
                .filter(MixedAgriFact.id.in_(fact_ids))
                .order_by(MixedAgriFact.id.asc())
                .all()
            )
        rows = [_fact_row(fact) for fact in facts]
        if action == "export_json":
            payload = {
                "exported_at": datetime.utcnow().isoformat(),
                "facts": rows
            }
            _log_action(
                "MIXED_AGRI_FACT_EXPORT",
                detail=(
                    f"format=json scope={scope} count={len(rows)} "
                    f"q={q or '-'} source_id={source_id or '-'}"
                )
            )
            db.session.commit()
            return _json_response(payload, "mixed_agri_facts_selected.json")
        fieldnames = [
            "id",
            "source_id",
            "source_title",
            "source_org",
            "topic",
            "region",
            "fact_text",
            "metric_value",
            "metric_unit",
            "metric_year",
        ]
        _log_action(
            "MIXED_AGRI_FACT_EXPORT",
            detail=(
                f"format=csv scope={scope} count={len(rows)} "
                f"q={q or '-'} source_id={source_id or '-'}"
            )
        )
        db.session.commit()
        return _csv_response(rows, fieldnames, "mixed_agri_facts_selected.csv")

    if action != "delete":
        flash("Select a valid bulk action", "danger")
        return redirect(_safe_next_url(url_for("expert.mixed_agri_facts")))

    if scope == "all":
        query = (
            MixedAgriFact.query
            .join(MixedAgriSource)
        )
        if source_id:
            query = query.filter(MixedAgriFact.source_id == int(source_id))
        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(
                    MixedAgriFact.fact_text.ilike(like),
                    MixedAgriFact.topic.ilike(like),
                    MixedAgriFact.region.ilike(like),
                    MixedAgriSource.source_title.ilike(like)
                )
            )
        deleted_count = query.delete(synchronize_session=False)
        detail = f"scope=all count={deleted_count} q={q or '-'} source_id={source_id or '-'}"
    else:
        deleted_count = (
            MixedAgriFact.query
            .filter(MixedAgriFact.id.in_(fact_ids))
            .delete(synchronize_session=False)
        )
        ids_preview = ",".join(str(item) for item in fact_ids[:25])
        detail = f"scope=selected count={deleted_count} ids={ids_preview}"
    _log_action("MIXED_AGRI_FACT_BULK_DELETE", detail=detail)

    db.session.commit()
    flash(f"Deleted {deleted_count} fact(s)", "warning")
    return redirect(_safe_next_url(url_for("expert.mixed_agri_facts")))


@expert_bp.route("/knowledge/mixed-agri/facts/new", methods=["GET", "POST"])
@role_required("expert")
def mixed_agri_fact_create():
    sources = MixedAgriSource.query.order_by(MixedAgriSource.source_title.asc()).all()
    if not sources:
        flash("Add at least one source before creating facts", "warning")
        return redirect(url_for("expert.mixed_agri_sources"))

    selected_source_id = request.args.get("source_id", type=int)

    if request.method == "POST":
        source_id = request.form.get("source_id")
        topic = (request.form.get("topic") or "").strip()
        region = (request.form.get("region") or "").strip() or None
        fact_text = (request.form.get("fact_text") or "").strip()
        metric_unit = (request.form.get("metric_unit") or "").strip() or None

        if not source_id or not topic or not fact_text:
            flash("Source, topic and fact text are required", "danger")
            return redirect(request.url)

        source = MixedAgriSource.query.get(int(source_id))
        if not source:
            flash("Selected source not found", "danger")
            return redirect(request.url)

        try:
            metric_value = _parse_decimal(
                request.form.get("metric_value"),
                "Metric value"
            )
            metric_year = _parse_int(
                request.form.get("metric_year"),
                "Metric year"
            )
        except ValueError as exc:
            flash(str(exc), "danger")
            return redirect(request.url)

        fact = MixedAgriFact(
            source_id=source.id,
            topic=topic,
            region=region,
            fact_text=fact_text,
            metric_value=metric_value,
            metric_unit=metric_unit,
            metric_year=metric_year
        )

        try:
            db.session.add(fact)
            db.session.flush()
            _log_action(
                "MIXED_AGRI_FACT_CREATE",
                target=f"fact:{fact.id}",
                detail=topic
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("This fact already exists for the selected source", "warning")
            return redirect(request.url)

        flash("Fact added", "success")
        return redirect(url_for("expert.mixed_agri_facts"))

    return render_template(
        "expert/knowledge/mixed_agri_fact_form.html",
        fact=None,
        sources=sources,
        is_edit=False,
        selected_source_id=selected_source_id
    )


@expert_bp.route("/knowledge/mixed-agri/facts/<int:fact_id>/edit", methods=["GET", "POST"])
@role_required("expert")
def mixed_agri_fact_edit(fact_id):
    fact = MixedAgriFact.query.get_or_404(fact_id)
    sources = MixedAgriSource.query.order_by(MixedAgriSource.source_title.asc()).all()

    if request.method == "POST":
        source_id = request.form.get("source_id")
        topic = (request.form.get("topic") or "").strip()
        region = (request.form.get("region") or "").strip() or None
        fact_text = (request.form.get("fact_text") or "").strip()
        metric_unit = (request.form.get("metric_unit") or "").strip() or None

        if not source_id or not topic or not fact_text:
            flash("Source, topic and fact text are required", "danger")
            return redirect(request.url)

        source = MixedAgriSource.query.get(int(source_id))
        if not source:
            flash("Selected source not found", "danger")
            return redirect(request.url)

        try:
            metric_value = _parse_decimal(
                request.form.get("metric_value"),
                "Metric value"
            )
            metric_year = _parse_int(
                request.form.get("metric_year"),
                "Metric year"
            )
        except ValueError as exc:
            flash(str(exc), "danger")
            return redirect(request.url)

        fact.source_id = source.id
        fact.topic = topic
        fact.region = region
        fact.fact_text = fact_text
        fact.metric_value = metric_value
        fact.metric_unit = metric_unit
        fact.metric_year = metric_year

        try:
            _log_action(
                "MIXED_AGRI_FACT_UPDATE",
                target=f"fact:{fact.id}",
                detail=topic
            )
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            flash("This fact already exists for the selected source", "warning")
            return redirect(request.url)

        flash("Fact updated", "success")
        return redirect(url_for("expert.mixed_agri_facts"))

    return render_template(
        "expert/knowledge/mixed_agri_fact_form.html",
        fact=fact,
        sources=sources,
        is_edit=True,
        selected_source_id=fact.source_id
    )


@expert_bp.route("/knowledge/mixed-agri/facts/<int:fact_id>/delete", methods=["POST"])
@role_required("expert")
def mixed_agri_fact_delete(fact_id):
    fact = MixedAgriFact.query.get_or_404(fact_id)
    _log_action(
        "MIXED_AGRI_FACT_DELETE",
        target=f"fact:{fact.id}",
        detail=fact.topic
    )
    db.session.delete(fact)
    db.session.commit()
    flash("Fact deleted", "warning")
    return redirect(url_for("expert.mixed_agri_facts"))
