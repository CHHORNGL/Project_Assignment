from __future__ import annotations

from typing import Any

from flask import render_template, request, url_for
from flask_login import current_user

from app.utils.i18n import get_current_language, normalize_display_text, t
from app.services.theme_manager import resolve_active_runtime


def _lang() -> str:
    return get_current_language()


def _text(value: Any) -> str:
    return normalize_display_text("" if value is None else str(value), lang=_lang())


def _copy(en: str, km: str | None = None) -> str:
    if _lang() == "km" and km:
        return normalize_display_text(km, lang="km")
    return normalize_display_text(en, lang=_lang())


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _request_full_path() -> str:
    full_path = request.full_path
    return full_path[:-1] if full_path.endswith("?") else full_path


def _localize_attr(obj, field: str, fallback: str = "") -> str:
    if obj is None:
        return _text(fallback)

    if _lang() == "km":
        value_kh = getattr(obj, f"{field}_kh", None)
        if value_kh:
            return _text(value_kh)

    return _text(getattr(obj, field, None) or fallback)


def _status_label(status: str | None) -> str:
    mapping = {
        "PENDING": t("status_pending"),
        "APPROVED": t("status_approved"),
        "REJECTED": t("status_rejected"),
        "AUTO": t("status_auto"),
    }
    return _text(mapping.get((status or "").upper(), status or ""))


def _severity_label(value: str | None) -> str:
    mapping = {
        "low": t("severity_low"),
        "medium": t("severity_medium"),
        "high": t("severity_high"),
        "critical": t("severity_critical"),
    }
    return _text(mapping.get(str(value or "").strip().lower(), value or ""))


def _qb_category_label(value: str | None) -> str:
    mapping = {
        "symptoms": t("qb_category_symptoms"),
        "pests": t("qb_category_pests"),
        "diseases": t("qb_category_diseases"),
        "environment": t("qb_category_environment"),
    }
    return _text(mapping.get(str(value or "").strip().lower(), value or ""))


def _qb_effect_label(value: str | None) -> str:
    mapping = {
        "none": t("qb_effect_none"),
        "confirm_symptom": t("qb_effect_confirm_symptom"),
        "deny_symptom": t("qb_effect_deny_symptom"),
        "set_category": t("qb_effect_set_category"),
    }
    return _text(mapping.get(str(value or "").strip().lower(), value or ""))


def _qb_condition_label(value: str | None) -> str:
    mapping = {
        "if": t("qb_condition_if"),
        "else": t("qb_condition_else"),
        "branch": t("qb_condition_branch"),
    }
    return _text(mapping.get(str(value or "").strip().lower(), value or ""))


def _qb_diag_label(value: str | None) -> str:
    mapping = {
        "fungal": t("qb_diag_fungal"),
        "bacterial": t("qb_diag_bacterial"),
        "viral": t("qb_diag_viral"),
        "pest": t("qb_diag_pest"),
        "nutrient": t("qb_diag_nutrient"),
        "environment": t("qb_diag_environment"),
        "other": t("qb_diag_other"),
    }
    return _text(mapping.get(str(value or "").strip().lower(), value or ""))


def _theme_runtime(scope: str):
    try:
        return resolve_active_runtime(scope)
    except Exception:
        return None


def _current_user_payload() -> dict[str, Any]:
    full_name = getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or "User"
    roles = []
    try:
        roles = [role.name for role in (current_user.roles or [])]
    except Exception:
        roles = []

    return {
        "id": getattr(current_user, "id", None),
        "username": _text(getattr(current_user, "username", "") or ""),
        "full_name": _text(full_name),
        "email": _text(getattr(current_user, "email", "") or ""),
        "roles": roles,
    }


def _base_bootstrap(page_id: str, scope: str, ui: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    return {
        "page": {
            "id": page_id,
            "scope": scope,
        },
        "path": request.path,
        "serverOrigin": request.url_root,
        "locale": "km-KH" if _lang() == "km" else "en-US",
        "settings": {
            "theme": getattr(current_user, "theme", "system") or "system",
        },
        "user": _current_user_payload(),
        "themeRuntime": _theme_runtime(scope),
        "ui": ui,
        "data": data,
    }


def render_react_page(*, bootstrap_payload: dict[str, Any], title: str, body_class: str = "", react_extra_css: list[str] | None = None):
    return render_template(
        "layouts/react_shell.html",
        bootstrap_payload=bootstrap_payload,
        react_page_title=title,
        react_body_class=body_class,
        react_extra_css=react_extra_css or [],
        react_loading_message=_copy("React page is loading...", "កំពុងផ្ទុកទំព័រ React..."),
    )


def build_admin_dashboard_bootstrap(*, total_users, total_diagnoses, pending_diagnoses, total_chats, recent_logs, scan_points, cesium_token):
    processed = max(int(total_diagnoses or 0) - int(pending_diagnoses or 0), 0)
    completion = (processed / total_diagnoses * 100.0) if total_diagnoses else 0.0

    ui = {
        "productName": "AGRI SYSTEM",
        "roleLabel": t("admin_control_center"),
        "eyebrow": t("admin_control_center"),
        "pageTitle": t("admin_control_center"),
        "pageSubtitle": t("admin_control_sub"),
        "pageLoading": _copy("Loading admin workspace", "កំពុងបើកផ្ទាំងគ្រប់គ្រងអ្នកគ្រប់គ្រង"),
        "actions": {
            "users": {"label": t("manage_users"), "href": url_for("admin.users")},
        },
        "navigation": {
            "sections": [
                {
                    "title": _copy("Overview", "ទិដ្ឋភាពទូទៅ"),
                    "items": [
                        {"label": t("admin_dashboard_title"), "href": url_for("admin.dashboard"), "description": t("admin_control_sub")},
                        {"label": t("world_map"), "href": url_for("admin.world"), "description": _copy("Geographic monitoring", "តាមដានផែនទី")},
                    ],
                },
                {
                    "title": _copy("Governance", "ការគ្រប់គ្រង"),
                    "items": [
                        {"label": t("manage_users"), "href": url_for("admin.users"), "description": _copy("Accounts and access", "គណនី និងសិទ្ធិ")},
                        {"label": t("roles"), "href": url_for("admin.roles"), "description": _copy("Permission sets", "សំណុំសិទ្ធិ")},
                        {"label": t("audit_logs"), "href": url_for("admin.audit_logs"), "description": _copy("Recent platform actions", "សកម្មភាពថ្មីៗ")},
                    ],
                },
            ],
        },
        "metrics": {
            "users": t("total_users"),
            "usersMeta": _copy("Current tenant footprint", "ចំនួនអ្នកប្រើប្រាស់សរុប"),
            "usersAccent": _copy("Live", "ផ្ទាល់"),
            "diagnoses": t("total_diagnoses"),
            "diagnosesMeta": _copy("Across all diagnosis flows", "គ្រប់លំហូរវិនិច្ឆ័យ"),
            "diagnosesAccent": _copy("Cases", "ករណី"),
            "pending": t("pending_diagnoses_title"),
            "pendingMeta": _copy("Cases waiting for expert review", "ករណីកំពុងរង់ចាំអ្នកជំនាញ"),
            "pendingAccent": _copy("Queue", "ជួរ"),
            "chats": t("active_chats"),
            "chatsMeta": _copy("Farmer conversation records", "កំណត់ត្រាការសន្ទនា"),
            "chatsAccent": _copy("Support", "គាំទ្រ"),
        },
        "sections": {
            "systemHealth": t("system_health"),
            "processingRate": t("processing_rate"),
            "completion": t("completion"),
            "pendingReview": t("pending"),
            "pendingHelp": t("cases_waiting_review"),
            "recentAuditEvents": t("recent_audit_events"),
            "recentAuditHelp": t("latest_admin_actions"),
            "calendarTime": _copy("Calendar & Time", "ប្រតិទិន និងពេលវេលា"),
            "calendarSubtitle": _copy("Track your admin schedule at a glance.", "តាមដានពេលវេលាការងាររបស់អ្នក។"),
            "map": t("google_map"),
            "operationsVolume": t("operations_volume"),
            "recentActivity": t("recent_activity"),
            "recentActivitySubtitle": _copy("Latest platform activity from the audit log.", "សកម្មភាពចុងក្រោយពីកំណត់ហេតុ។"),
            "noScanPoints": _copy("No scan points are available yet.", "មិនទាន់មានចំណុចស្កេនទេ។"),
            "worldFeed": _copy("Geo feed linked from backend", "ទិន្នន័យភូមិសាស្ត្រពីប្រព័ន្ធក្រោយ"),
        },
        "operations": {
            "users": t("users"),
            "diagnoses": t("diagnoses_label"),
            "pending": t("status_pending"),
            "chats": t("active_chats"),
        },
        "map": {
            "lat": t("lat"),
            "lng": t("lng"),
            "update": t("update_map"),
            "open": t("open_in_maps"),
            "locate": t("use_my_location"),
            "hint": t("map_hint"),
        },
        "table": {
            "action": _copy("Action", "សកម្មភាព"),
            "detail": _copy("Detail", "ព័ត៌មានលម្អិត"),
            "time": _copy("Time", "ពេលវេលា"),
            "emptyTitle": _copy("No recent activity", "មិនទាន់មានសកម្មភាពថ្មី"),
            "emptyText": t("no_recent_activity"),
        },
        "weekdays": [t("sun"), t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat")],
    }

    data = {
        "totalUsers": int(total_users or 0),
        "totalDiagnoses": int(total_diagnoses or 0),
        "pendingDiagnoses": int(pending_diagnoses or 0),
        "totalChats": int(total_chats or 0),
        "processedCount": processed,
        "completionPercent": round(completion, 1),
        "processedSummary": t("processed_out_of", processed=processed, total=total_diagnoses),
        "recentLogs": [
            {
                "id": log.id,
                "action": _text(log.action),
                "targetUser": _text(log.target_user or ""),
                "detail": _text(log.detail or ""),
                "actorName": _text(getattr(getattr(log, "user", None), "full_name", None) or getattr(getattr(log, "user", None), "username", None) or ""),
                "createdAt": _iso(log.created_at),
            }
            for log in (recent_logs or [])
        ],
        "scanPoints": [
            {
                "id": point.get("id") or point.get("label"),
                "label": _text(point.get("label") or point.get("name") or ""),
                "region": _text(point.get("region") or ""),
                "status": _text(point.get("status") or "active"),
                "statusLabel": _text(point.get("status_label") or point.get("status") or "active"),
            }
            for point in (scan_points or [])
            if isinstance(point, dict)
        ],
        "map": {
            "lat": 11.5564,
            "lng": 104.9282,
            "cesiumToken": _text(cesium_token or ""),
        },
    }

    return _base_bootstrap("admin-dashboard", "admin", ui, data)


def build_expert_dashboard_bootstrap(*, diagnoses, auto_cases, approved_count, rejected_count, chat_count, chart_labels, chart_values):
    pending_count = len(diagnoses or [])
    reviewed = int(approved_count or 0) + int(rejected_count or 0)
    total_cases = max(pending_count + reviewed, 1)

    ui = {
        "productName": "AGRI SYSTEM",
        "roleLabel": t("expert_command_center"),
        "eyebrow": t("expert_command_center"),
        "pageTitle": t("expert_command_center"),
        "pageSubtitle": t("expert_command_sub"),
        "actions": {
            "pending": {"label": _copy("Review pending", "ពិនិត្យករណីរង់ចាំ"), "href": url_for("expert.pending_diagnoses")},
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.diseases")},
        },
        "navigation": {
            "sections": [
                {
                    "title": _copy("Review", "ការពិនិត្យ"),
                    "items": [
                        {"label": t("expert_dashboard_title"), "href": url_for("expert.dashboard"), "description": t("expert_command_sub")},
                        {"label": _copy("Pending diagnoses", "ករណីរង់ចាំ"), "href": url_for("expert.pending_diagnoses"), "description": _copy("Open review queue", "ជួរពិនិត្យ")},
                        {"label": _copy("Farmer chats", "សារកសិករ"), "href": url_for("expert.farmer_chats"), "description": _copy("Support conversations", "ការគាំទ្រ")},
                    ],
                },
                {
                    "title": _copy("Knowledge", "ចំណេះដឹង"),
                    "items": [
                        {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard"), "description": _copy("Rules and sources", "ច្បាប់ និងប្រភព")},
                        {"label": _copy("Disease manager", "គ្រប់គ្រងជំងឺ"), "href": url_for("expert.diseases"), "description": _copy("Structured diagnoses", "វិនិច្ឆ័យជាចំណាត់ថ្នាក់")},
                        {"label": _copy("Support hub", "មជ្ឈមណ្ឌលគាំទ្រ"), "href": url_for("expert.support_hub"), "description": _copy("Escalations and chats", "ករណីបន្ត និងសារ")},
                    ],
                },
            ],
        },
        "metrics": {
            "pending": t("pending_cases"),
            "pendingMeta": t("awaiting_review"),
            "pendingAccent": _copy("Review", "ពិនិត្យ"),
            "auto": t("status_auto"),
            "autoMeta": _copy("Automated cases waiting for confirmation", "ករណីស្វ័យប្រវត្តិកំពុងរង់ចាំការបញ្ជាក់"),
            "autoAccent": _copy("Auto", "ស្វ័យប្រវត្តិ"),
            "approved": t("status_approved"),
            "approvedMeta": t("validated_diagnoses"),
            "approvedAccent": _copy("Accepted", "បានយល់ព្រម"),
            "rejected": t("status_rejected"),
            "rejectedMeta": t("needs_correction"),
            "rejectedAccent": _copy("Rejected", "បដិសេធ"),
            "chats": t("active_chats"),
            "chatsMeta": t("live_farmer_support"),
            "chatsAccent": _copy("Support", "គាំទ្រ"),
        },
        "sections": {
            "pipeline": t("review_pipeline"),
            "reviewPipeline": t("review_pipeline"),
            "reviewSubtitle": t("progress_all_status"),
            "calendarTime": t("calendar_time"),
            "calendarSubtitle": t("review_schedule"),
            "pendingQueue": _copy("Pending diagnosis queue", "ជួរករណីរង់ចាំ"),
            "pendingQueueSubtitle": _copy("Cases waiting for expert action.", "ករណីកំពុងរង់ចាំការសម្រេច។"),
            "outcomeMix": t("case_breakdown"),
            "autoCases": _copy("Auto cases", "ករណីស្វ័យប្រវត្តិ"),
            "autoCasesSubtitle": _copy("Quick validation of automated results.", "ពិនិត្យលទ្ធផលស្វ័យប្រវត្តិឱ្យបានលឿន។"),
        },
        "table": {
            "case": _copy("Case", "ករណី"),
            "farmer": _copy("Farmer", "កសិករ"),
            "status": _copy("Status", "ស្ថានភាព"),
            "open": _copy("Open", "បើក"),
            "review": _copy("Review case", "ពិនិត្យករណី"),
            "suggestion": _copy("Suggestion", "សំណើ"),
            "confidence": _copy("Confidence", "ភាពជឿជាក់"),
            "validate": _copy("Validate", "បញ្ជាក់"),
            "emptyTitle": _copy("No records", "មិនមានទិន្នន័យ"),
            "emptyText": _copy("Rows will appear here when the backend returns data.", "ទិន្នន័យនឹងបង្ហាញនៅទីនេះ។"),
        },
        "weekdays": [t("sun"), t("mon"), t("tue"), t("wed"), t("thu"), t("fri"), t("sat")],
    }

    data = {
        "pendingCount": pending_count,
        "approvedCount": int(approved_count or 0),
        "rejectedCount": int(rejected_count or 0),
        "chatCount": int(chat_count or 0),
        "chartLabels": [_text(label) for label in (chart_labels or [])],
        "chartValues": [int(value or 0) for value in (chart_values or [])],
        "pipeline": [
            {"key": "reviewed", "label": t("reviewed"), "value": reviewed, "percent": round((reviewed / total_cases) * 100.0, 1)},
            {"key": "approved", "label": t("status_approved"), "value": int(approved_count or 0), "percent": round((int(approved_count or 0) / total_cases) * 100.0, 1)},
            {"key": "rejected", "label": t("status_rejected"), "value": int(rejected_count or 0), "percent": round((int(rejected_count or 0) / total_cases) * 100.0, 1)},
            {"key": "pending", "label": t("status_pending"), "value": pending_count, "percent": round((pending_count / total_cases) * 100.0, 1)},
        ],
        "diagnoses": [
            {
                "id": diagnosis.id,
                "cropName": _localize_attr(diagnosis.crop, "name", diagnosis.crop_name),
                "diseaseName": _localize_attr(diagnosis.disease, "name", diagnosis.disease_name),
                "status": _text(diagnosis.status),
                "statusLabel": _status_label(diagnosis.status),
                "confidence": float(diagnosis.confidence or 0),
                "farmerName": _text(getattr(diagnosis.farmer, "full_name", None) or getattr(diagnosis.farmer, "username", None) or ""),
                "createdAt": _iso(diagnosis.created_at),
                "reviewUrl": url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
            }
            for diagnosis in (diagnoses or [])
        ],
        "autoCases": [
            {
                "id": diagnosis.id,
                "cropName": _localize_attr(diagnosis.crop, "name", diagnosis.crop_name),
                "diseaseName": _localize_attr(diagnosis.disease, "name", diagnosis.disease_name),
                "status": _text(diagnosis.status),
                "statusLabel": _status_label(diagnosis.status),
                "confidence": float(diagnosis.confidence or 0),
                "createdAt": _iso(diagnosis.created_at),
                "reviewUrl": url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
            }
            for diagnosis in (auto_cases or [])
        ],
    }

    return _base_bootstrap("expert-dashboard", "expert", ui, data)


def _expert_navigation_sections():
    return [
        {
            "title": _copy("Review", "ការពិនិត្យ"),
            "items": [
                {"label": t("expert_dashboard_title"), "href": url_for("expert.dashboard"), "description": t("expert_command_sub")},
                {"label": _copy("Pending diagnoses", "ករណីរង់ចាំ"), "href": url_for("expert.pending_diagnoses"), "description": _copy("Open review queue", "ជួរពិនិត្យ")},
                {"label": _copy("Farmer chats", "សារកសិករ"), "href": url_for("expert.farmer_chats"), "description": _copy("Support conversations", "ការគាំទ្រ")},
            ],
        },
        {
            "title": _copy("Knowledge", "ចំណេះដឹង"),
            "items": [
                {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard"), "description": _copy("Rules and sources", "ច្បាប់ និងប្រភព")},
                {"label": _copy("Disease manager", "គ្រប់គ្រងជំងឺ"), "href": url_for("expert.diseases"), "description": _copy("Structured diagnoses", "វិនិច្ឆ័យជាចំណាត់ថ្នាក់")},
                {"label": _copy("Support hub", "មជ្ឈមណ្ឌលគាំទ្រ"), "href": url_for("expert.support_hub"), "description": _copy("Escalations and chats", "ករណីបន្ត និងសារ")},
            ],
        },
    ]


def _expert_shell_ui(*, eyebrow: str, title: str, subtitle: str, actions: dict[str, dict[str, str]] | None = None):
    return {
        "productName": "AGRI SYSTEM",
        "roleLabel": t("expert_command_center"),
        "eyebrow": _text(eyebrow),
        "pageTitle": _text(title),
        "pageSubtitle": _text(subtitle),
        "actions": actions or {},
        "navigation": {
            "sections": _expert_navigation_sections(),
        },
    }


def build_expert_knowledge_dashboard_bootstrap(
    *,
    symptom_count,
    rule_count,
    disease_count,
    mixed_source_count,
    mixed_fact_count,
    rules,
):
    ui = _expert_shell_ui(
        eyebrow=t("knowledge_base"),
        title=t("knowledge_base"),
        subtitle=_copy("Manage symptoms, rules, diagnosis knowledge, and mixed agriculture content in one workspace."),
        actions={
            "diseases": {"label": t("diagnosis_knowledge"), "href": url_for("expert.diseases")},
            "addRule": {"label": t("add_rule"), "href": url_for("expert.create_rule")},
        },
    )
    ui["metrics"] = {
        "symptoms": t("symptoms_label"),
        "symptomsMeta": t("add_symptom"),
        "symptomsAccent": _copy("Inputs"),
        "rules": t("rules_engine"),
        "rulesMeta": t("add_rule"),
        "rulesAccent": _copy("Logic"),
        "diseases": t("diseases"),
        "diseasesMeta": t("diagnosis_knowledge"),
        "diseasesAccent": _copy("Library"),
        "sources": t("mixed_agri_sources"),
        "sourcesMeta": t("manage_sources"),
        "sourcesAccent": _copy("Sources"),
        "facts": t("mixed_agri_facts"),
        "factsMeta": t("manage_facts"),
        "factsAccent": _copy("Facts"),
    }
    ui["sections"] = {
        "workspace": _copy("Knowledge tools"),
        "workspaceSubtitle": _copy("Jump into the authoring flows used to keep the expert knowledge base current."),
        "mixedAgri": t("mixed_agriculture"),
        "mixedAgriSubtitle": _copy("Maintain source material and agricultural fact records."),
        "rules": t("diagnosis_rules_engine"),
        "rulesSubtitle": t("total_count", count=int(rule_count or 0)),
    }
    ui["labels"] = {
        "addSymptom": t("add_symptom"),
        "addRule": t("add_rule"),
        "diagnosisKnowledge": t("diagnosis_knowledge"),
        "mixedAgriculture": t("mixed_agriculture"),
        "manageSources": t("manage_sources"),
        "manageFacts": t("manage_facts"),
        "openWorkspace": _copy("Open workspace"),
        "id": t("id_label"),
        "ruleName": t("rule_name"),
        "disease": t("disease_label"),
        "symptoms": t("symptoms_label"),
        "confidence": t("confidence_label"),
        "notAvailable": _copy("Not available"),
        "noRulesAdded": t("no_rules_added"),
        "rulesAppearHere": _copy("Rules will appear here once the backend returns expert knowledge records."),
    }

    data = {
        "metrics": {
            "symptomCount": int(symptom_count or 0),
            "ruleCount": int(rule_count or 0),
            "diseaseCount": int(disease_count or 0),
            "mixedSourceCount": int(mixed_source_count or 0),
            "mixedFactCount": int(mixed_fact_count or 0),
        },
        "links": {
            "createSymptomUrl": url_for("expert.create_symptom"),
            "createRuleUrl": url_for("expert.create_rule"),
            "mixedAgriDashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "mixedAgriSourcesUrl": url_for("expert.mixed_agri_sources"),
            "mixedAgriFactsUrl": url_for("expert.mixed_agri_facts"),
            "diseasesUrl": url_for("expert.diseases"),
        },
        "rules": [
            {
                "id": rule.id,
                "name": _text(rule.name),
                "diseaseName": _localize_attr(rule.disease, "name", "-"),
                "symptomNames": [_text(item) for item in (rule.symptom_names() or []) if item],
                "confidencePercent": round(float(rule.confidence or 0) * 100.0, 0) if rule.confidence is not None else None,
            }
            for rule in (rules or [])
        ],
    }

    return _base_bootstrap("expert-knowledge-dashboard", "expert", ui, data)


def build_expert_create_symptom_bootstrap():
    ui = _expert_shell_ui(
        eyebrow=t("add_symptom"),
        title=t("add_symptom"),
        subtitle=_copy("Capture a reusable symptom entry for future diagnosis rules and expert workflows."),
        actions={
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard")},
            "addRule": {"label": t("add_rule"), "href": url_for("expert.create_rule")},
        },
    )
    ui["sections"] = {
        "form": t("add_symptom"),
        "formSubtitle": _copy("Save the symptom name and both language descriptions so it can be reused consistently."),
        "guidance": _copy("Authoring guidance"),
        "guidanceSubtitle": _copy("A clear symptom entry makes rule creation easier and keeps the knowledge base consistent."),
    }
    ui["labels"] = {
        "back": t("back"),
        "symptomName": t("symptom_name"),
        "symptomNamePlaceholder": t("symptom_name_placeholder"),
        "description": t("description_label"),
        "descriptionPlaceholder": t("description_placeholder"),
        "symptomNameKh": t("symptom_name_kh"),
        "symptomNameKhPlaceholder": t("symptom_name_kh_placeholder"),
        "symptomDescriptionKh": t("symptom_description_kh"),
        "descriptionKhPlaceholder": t("description_kh_placeholder"),
        "saveSymptom": t("save_symptom"),
        "cancel": t("cancel"),
        "guidanceOne": _copy("Use one symptom per entry instead of combining multiple signs in one name."),
        "guidanceTwo": _copy("Keep names short and field-observable so farmers and experts can match them easily."),
        "guidanceThree": _copy("Add Khmer details when available to improve local readability."),
    }

    data = {
        "formAction": request.path,
        "backUrl": url_for("expert.knowledge_dashboard"),
        "links": {
            "knowledgeUrl": url_for("expert.knowledge_dashboard"),
            "createRuleUrl": url_for("expert.create_rule"),
        },
    }

    return _base_bootstrap("expert-create-symptom", "expert", ui, data)


def build_expert_create_rule_bootstrap(*, symptoms, diseases):
    ui = _expert_shell_ui(
        eyebrow=t("create_diagnosis_rule"),
        title=t("create_diagnosis_rule"),
        subtitle=_copy("Link diagnosis knowledge to observable symptoms and set an expert confidence score."),
        actions={
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard")},
            "diseases": {"label": t("diagnosis_knowledge"), "href": url_for("expert.diseases")},
        },
    )
    ui["sections"] = {
        "form": t("create_rule_title"),
        "formSubtitle": _copy("Choose a disease, attach the supporting symptoms, and define the rule confidence."),
        "summary": _copy("Knowledge summary"),
        "summarySubtitle": _copy("These counts reflect the current disease and symptom options available for rule authoring."),
    }
    ui["labels"] = {
        "back": t("back"),
        "ruleName": t("rule_name"),
        "ruleNamePlaceholder": _copy("e.g. Early Blight Rule"),
        "disease": t("disease_label"),
        "selectDisease": t("select_disease"),
        "noDiseasesFound": t("no_diseases_found"),
        "symptoms": t("symptoms_label"),
        "noSymptomsFound": t("no_symptoms_found"),
        "holdCtrlSelectMultipleSymptoms": t("hold_ctrl_select_multiple_symptoms"),
        "confidence": t("confidence_label"),
        "confidencePlaceholder": _copy("e.g. 0.85"),
        "saveRule": t("save_rule"),
        "cancel": t("cancel"),
        "availableDiseases": t("diseases"),
        "availableSymptoms": t("symptoms_label"),
        "selectedSymptoms": _copy("Selected symptoms"),
        "ruleHelp": _copy("Use a confidence between 0 and 1 to reflect how strongly these symptoms support the diagnosis."),
    }

    data = {
        "formAction": request.path,
        "backUrl": url_for("expert.knowledge_dashboard"),
        "options": {
            "diseases": [
                {
                    "id": disease.id,
                    "name": _localize_attr(disease, "name", getattr(disease, "name", "")),
                }
                for disease in (diseases or [])
            ],
            "symptoms": [
                {
                    "id": symptom.id,
                    "name": _localize_attr(symptom, "name", getattr(symptom, "name", "")),
                }
                for symptom in (symptoms or [])
            ],
        },
        "stats": {
            "diseaseCount": len(diseases or []),
            "symptomCount": len(symptoms or []),
        },
        "links": {
            "knowledgeUrl": url_for("expert.knowledge_dashboard"),
            "diseasesUrl": url_for("expert.diseases"),
        },
    }

    return _base_bootstrap("expert-create-rule", "expert", ui, data)


def build_expert_mixed_agri_dashboard_bootstrap(*, source_count, fact_count, facts, pagination):
    ui = _expert_shell_ui(
        eyebrow=t("mixed_agri_knowledge"),
        title=t("mixed_agri_knowledge_hub"),
        subtitle=t("mixed_agri_hero_sub"),
        actions={
            "sources": {"label": t("manage_sources"), "href": url_for("expert.mixed_agri_sources")},
            "facts": {"label": t("manage_facts"), "href": url_for("expert.mixed_agri_facts")},
        },
    )
    ui["metrics"] = {
        "sources": t("sources"),
        "sourcesMeta": t("manage_sources"),
        "sourcesAccent": _copy("Library"),
        "facts": t("facts"),
        "factsMeta": t("manage_facts"),
        "factsAccent": _copy("Insights"),
    }
    ui["sections"] = {
        "library": t("facts_library"),
        "librarySubtitle": t("facts_library_sub"),
        "density": t("adjust_density"),
    }
    ui["labels"] = {
        "id": t("id_label"),
        "source": t("source"),
        "topic": t("topic"),
        "region": t("region"),
        "fact": t("fact"),
        "apply": t("apply"),
        "prev": t("prev"),
        "next": t("next"),
        "pageOf": t("page_of", page=int((pagination or {}).get("page") or 1), pages=int((pagination or {}).get("pages") or 1)),
        "showingRange": t(
            "showing_range",
            start=int((pagination or {}).get("start") or 0),
            end=int((pagination or {}).get("end") or 0),
            total=int((pagination or {}).get("total") or 0),
        ),
        "noFactsAdded": t("no_facts_added"),
    }

    data = {
        "metrics": {
            "sourceCount": int(source_count or 0),
            "factCount": int(fact_count or 0),
        },
        "filters": {
            "perPage": int((pagination or {}).get("per_page") or 10),
        },
        "pagination": {
            "page": int((pagination or {}).get("page") or 1),
            "perPage": int((pagination or {}).get("per_page") or 10),
            "total": int((pagination or {}).get("total") or 0),
            "pages": int((pagination or {}).get("pages") or 1),
            "start": int((pagination or {}).get("start") or 0),
            "end": int((pagination or {}).get("end") or 0),
            "hasPrev": bool((pagination or {}).get("has_prev")),
            "hasNext": bool((pagination or {}).get("has_next")),
        },
        "facts": [
            {
                "id": fact.id,
                "sourceTitle": _text(getattr(getattr(fact, "source", None), "source_title", None) or "-"),
                "topic": _text(getattr(fact, "topic", None) or ""),
                "region": _text(getattr(fact, "region", None) or "-"),
                "factText": _text(getattr(fact, "fact_text", None) or ""),
            }
            for fact in (facts or [])
        ],
        "links": {
            "dashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "sourcesUrl": url_for("expert.mixed_agri_sources"),
            "factsUrl": url_for("expert.mixed_agri_facts"),
        },
        "options": {
            "perPage": [10, 25, 50],
        },
    }

    return _base_bootstrap("expert-mixed-agri-dashboard", "expert", ui, data)


def build_expert_mixed_agri_sources_bootstrap(*, sources, q, pagination):
    ui = _expert_shell_ui(
        eyebrow=t("mixed_agri_sources"),
        title=t("mixed_agri_sources"),
        subtitle=_copy("Search, export, and maintain the source library that supports mixed agriculture facts."),
        actions={
            "dashboard": {"label": t("back"), "href": url_for("expert.mixed_agri_dashboard")},
            "create": {"label": t("add_source"), "href": url_for("expert.mixed_agri_source_create")},
        },
    )
    ui["sections"] = {
        "filters": t("search"),
        "filtersSubtitle": _copy("Filter the source library and control page density."),
        "sources": t("sources"),
        "sourcesSubtitle": t("total_count", count=int((pagination or {}).get("total") or 0)),
    }
    ui["labels"] = {
        "searchSourcesPlaceholder": t("search_sources_placeholder"),
        "search": t("search"),
        "clear": t("clear"),
        "exportCsv": t("export_csv"),
        "exportJson": t("export_json"),
        "bulkAction": t("bulk_action"),
        "deleteSelected": t("delete_selected"),
        "exportSelectedCsv": t("export_selected_csv"),
        "exportSelectedJson": t("export_selected_json"),
        "apply": t("apply"),
        "applyAllFiltered": t("apply_all_filtered", count=int((pagination or {}).get("total") or 0)),
        "id": t("id_label"),
        "title": t("title"),
        "org": t("org"),
        "year": t("year"),
        "type": t("type"),
        "url": t("url"),
        "accessed": t("accessed"),
        "facts": t("facts"),
        "actions": t("actions"),
        "edit": t("edit"),
        "addFact": t("add_fact"),
        "delete": t("delete"),
        "confirmDeleteSource": t("confirm_delete_source"),
        "noSourcesFound": t("no_sources_found"),
        "showingRange": t(
            "showing_range",
            start=int((pagination or {}).get("start") or 0),
            end=int((pagination or {}).get("end") or 0),
            total=int((pagination or {}).get("total") or 0),
        ),
        "pageOf": t("page_of", page=int((pagination or {}).get("page") or 1), pages=int((pagination or {}).get("pages") or 1)),
        "prev": t("prev"),
        "next": t("next"),
        "selectAtLeastOne": _copy("Select at least one source."),
        "bulkActionRequired": _copy("Select a bulk action first."),
        "confirmBulkDeleteSelected": _copy("Delete the selected sources?"),
        "confirmBulkDeleteAll": _copy("Delete all filtered sources?"),
        "confirmBulkExportSelected": _copy("Export the selected sources?"),
        "confirmBulkExportAll": _copy("Export all filtered sources?"),
    }

    data = {
        "filters": {
            "q": _text(q or ""),
            "perPage": int((pagination or {}).get("per_page") or 25),
        },
        "pagination": {
            "page": int((pagination or {}).get("page") or 1),
            "perPage": int((pagination or {}).get("per_page") or 25),
            "total": int((pagination or {}).get("total") or 0),
            "pages": int((pagination or {}).get("pages") or 1),
            "start": int((pagination or {}).get("start") or 0),
            "end": int((pagination or {}).get("end") or 0),
            "hasPrev": bool((pagination or {}).get("has_prev")),
            "hasNext": bool((pagination or {}).get("has_next")),
        },
        "sources": [
            {
                "id": source.id,
                "sourceTitle": _text(getattr(source, "source_title", None) or ""),
                "sourceOrg": _text(getattr(source, "source_org", None) or ""),
                "publicationYear": getattr(source, "publication_year", None),
                "sourceType": _text(getattr(source, "source_type", None) or "-"),
                "sourceUrl": _text(getattr(source, "source_url", None) or ""),
                "accessedAt": _iso(getattr(source, "accessed_at", None)),
                "factCount": len(getattr(source, "facts", []) or []),
                "editUrl": url_for("expert.mixed_agri_source_edit", source_id=source.id),
                "addFactUrl": url_for("expert.mixed_agri_fact_create", source_id=source.id),
                "deleteAction": url_for("expert.mixed_agri_source_delete", source_id=source.id),
            }
            for source in (sources or [])
        ],
        "links": {
            "dashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "sourcesUrl": url_for("expert.mixed_agri_sources"),
            "createUrl": url_for("expert.mixed_agri_source_create"),
            "bulkActionUrl": url_for("expert.mixed_agri_sources_bulk"),
            "exportCsvUrl": url_for("expert.mixed_agri_sources_export", format="csv", q=q or ""),
            "exportJsonUrl": url_for("expert.mixed_agri_sources_export", format="json", q=q or ""),
            "currentUrl": _request_full_path(),
        },
        "options": {
            "perPage": [25, 50, 100],
            "bulkActions": [
                {"id": "delete", "label": t("delete_selected")},
                {"id": "export_csv", "label": t("export_selected_csv")},
                {"id": "export_json", "label": t("export_selected_json")},
            ],
        },
    }

    return _base_bootstrap("expert-mixed-agri-sources", "expert", ui, data)


def build_expert_mixed_agri_source_form_bootstrap(*, source=None, is_edit=False):
    page_title = f"{t('edit') if is_edit else t('add')} {t('source')}"
    ui = _expert_shell_ui(
        eyebrow=page_title,
        title=page_title,
        subtitle=_copy("Capture source metadata so the fact library keeps a clear evidence trail."),
        actions={
            "sources": {"label": t("mixed_agri_sources"), "href": url_for("expert.mixed_agri_sources")},
            "dashboard": {"label": t("mixed_agri_knowledge"), "href": url_for("expert.mixed_agri_dashboard")},
        },
    )
    ui["sections"] = {
        "form": page_title,
        "formSubtitle": _copy("Save title, organization, year, URL, and access date for this source entry."),
    }
    ui["labels"] = {
        "back": t("back"),
        "sourceTitle": t("source_title"),
        "organization": t("organization"),
        "publicationYear": t("publication_year"),
        "sourceType": t("source_type"),
        "accessedDate": t("accessed_date"),
        "sourceUrl": t("source_url"),
        "urlPlaceholder": t("url_placeholder"),
        "save": t("save"),
        "update": t("update"),
        "source": t("source"),
        "cancel": t("cancel"),
    }

    data = {
        "isEdit": bool(is_edit),
        "formAction": request.path,
        "backUrl": url_for("expert.mixed_agri_sources"),
        "links": {
            "dashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "sourcesUrl": url_for("expert.mixed_agri_sources"),
        },
        "formValues": {
            "sourceTitle": _text(getattr(source, "source_title", None) or ""),
            "sourceOrg": _text(getattr(source, "source_org", None) or ""),
            "publicationYear": _text(getattr(source, "publication_year", None) or ""),
            "sourceType": _text(getattr(source, "source_type", None) or ""),
            "accessedAt": _iso(getattr(source, "accessed_at", None)),
            "sourceUrl": _text(getattr(source, "source_url", None) or ""),
        },
    }

    return _base_bootstrap("expert-mixed-agri-source-form", "expert", ui, data)


def build_expert_mixed_agri_facts_bootstrap(*, facts, sources, q, source_id, pagination):
    ui = _expert_shell_ui(
        eyebrow=t("mixed_agri_facts"),
        title=t("mixed_agri_facts"),
        subtitle=_copy("Review and manage agriculture fact records, then export or delete them in bulk."),
        actions={
            "dashboard": {"label": t("back"), "href": url_for("expert.mixed_agri_dashboard")},
            "create": {"label": t("add_fact"), "href": url_for("expert.mixed_agri_fact_create")},
        },
    )
    ui["sections"] = {
        "filters": t("filter"),
        "filtersSubtitle": _copy("Limit the list by source, search term, and page density."),
        "facts": t("facts"),
        "factsSubtitle": t("total_count", count=int((pagination or {}).get("total") or 0)),
    }
    ui["labels"] = {
        "allSources": t("all_sources"),
        "searchFactsPlaceholder": t("search_facts_placeholder"),
        "filter": t("filter"),
        "clear": t("clear"),
        "exportCsv": t("export_csv"),
        "exportJson": t("export_json"),
        "bulkAction": t("bulk_action"),
        "deleteSelected": t("delete_selected"),
        "exportSelectedCsv": t("export_selected_csv"),
        "exportSelectedJson": t("export_selected_json"),
        "apply": t("apply"),
        "applyAllFiltered": t("apply_all_filtered", count=int((pagination or {}).get("total") or 0)),
        "id": t("id_label"),
        "source": t("source"),
        "topic": t("topic"),
        "region": t("region"),
        "metric": t("metric"),
        "fact": t("fact"),
        "actions": t("actions"),
        "edit": t("edit"),
        "delete": t("delete"),
        "confirmDeleteFact": t("confirm_delete_fact"),
        "noFactsFound": t("no_facts_found"),
        "showingRange": t(
            "showing_range",
            start=int((pagination or {}).get("start") or 0),
            end=int((pagination or {}).get("end") or 0),
            total=int((pagination or {}).get("total") or 0),
        ),
        "pageOf": t("page_of", page=int((pagination or {}).get("page") or 1), pages=int((pagination or {}).get("pages") or 1)),
        "prev": t("prev"),
        "next": t("next"),
        "selectAtLeastOne": _copy("Select at least one fact."),
        "bulkActionRequired": _copy("Select a bulk action first."),
        "confirmBulkDeleteSelected": _copy("Delete the selected facts?"),
        "confirmBulkDeleteAll": _copy("Delete all filtered facts?"),
        "confirmBulkExportSelected": _copy("Export the selected facts?"),
        "confirmBulkExportAll": _copy("Export all filtered facts?"),
    }

    data = {
        "filters": {
            "q": _text(q or ""),
            "sourceId": str(source_id or ""),
            "perPage": int((pagination or {}).get("per_page") or 25),
        },
        "pagination": {
            "page": int((pagination or {}).get("page") or 1),
            "perPage": int((pagination or {}).get("per_page") or 25),
            "total": int((pagination or {}).get("total") or 0),
            "pages": int((pagination or {}).get("pages") or 1),
            "start": int((pagination or {}).get("start") or 0),
            "end": int((pagination or {}).get("end") or 0),
            "hasPrev": bool((pagination or {}).get("has_prev")),
            "hasNext": bool((pagination or {}).get("has_next")),
        },
        "facts": [
            {
                "id": fact.id,
                "sourceTitle": _text(getattr(getattr(fact, "source", None), "source_title", None) or "-"),
                "topic": _text(getattr(fact, "topic", None) or ""),
                "region": _text(getattr(fact, "region", None) or "-"),
                "metricValue": _text(getattr(fact, "metric_value", None) or ""),
                "metricUnit": _text(getattr(fact, "metric_unit", None) or ""),
                "metricYear": getattr(fact, "metric_year", None),
                "factText": _text(getattr(fact, "fact_text", None) or ""),
                "editUrl": url_for("expert.mixed_agri_fact_edit", fact_id=fact.id),
                "deleteAction": url_for("expert.mixed_agri_fact_delete", fact_id=fact.id),
            }
            for fact in (facts or [])
        ],
        "sources": [
            {
                "id": source.id,
                "title": _text(getattr(source, "source_title", None) or ""),
            }
            for source in (sources or [])
        ],
        "links": {
            "dashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "factsUrl": url_for("expert.mixed_agri_facts"),
            "createUrl": url_for("expert.mixed_agri_fact_create"),
            "bulkActionUrl": url_for("expert.mixed_agri_facts_bulk"),
            "exportCsvUrl": url_for("expert.mixed_agri_facts_export", format="csv", q=q or "", source_id=source_id),
            "exportJsonUrl": url_for("expert.mixed_agri_facts_export", format="json", q=q or "", source_id=source_id),
            "currentUrl": _request_full_path(),
        },
        "options": {
            "perPage": [25, 50, 100],
            "bulkActions": [
                {"id": "delete", "label": t("delete_selected")},
                {"id": "export_csv", "label": t("export_selected_csv")},
                {"id": "export_json", "label": t("export_selected_json")},
            ],
        },
    }

    return _base_bootstrap("expert-mixed-agri-facts", "expert", ui, data)


def build_expert_mixed_agri_fact_form_bootstrap(*, fact=None, sources=None, is_edit=False, selected_source_id=None):
    page_title = f"{t('edit') if is_edit else t('add')} {t('fact')}"
    ui = _expert_shell_ui(
        eyebrow=page_title,
        title=page_title,
        subtitle=_copy("Capture mixed agriculture evidence with source linkage, topic, region, and metric details."),
        actions={
            "facts": {"label": t("mixed_agri_facts"), "href": url_for("expert.mixed_agri_facts")},
            "dashboard": {"label": t("mixed_agri_knowledge"), "href": url_for("expert.mixed_agri_dashboard")},
        },
    )
    ui["sections"] = {
        "form": page_title,
        "formSubtitle": _copy("Record the fact text and optional metric details while keeping it tied to a source."),
    }
    ui["labels"] = {
        "back": t("back"),
        "source": t("source"),
        "selectSource": t("select_source"),
        "topic": t("topic"),
        "region": t("region"),
        "factText": t("fact_text"),
        "metricValue": t("metric_value"),
        "metricValuePlaceholder": t("metric_value_placeholder"),
        "metricUnit": t("metric_unit"),
        "metricUnitPlaceholder": t("metric_unit_placeholder"),
        "metricYear": t("metric_year"),
        "save": t("save"),
        "update": t("update"),
        "fact": t("fact"),
        "cancel": t("cancel"),
    }

    data = {
        "isEdit": bool(is_edit),
        "formAction": request.path,
        "backUrl": url_for("expert.mixed_agri_facts"),
        "links": {
            "dashboardUrl": url_for("expert.mixed_agri_dashboard"),
            "factsUrl": url_for("expert.mixed_agri_facts"),
            "sourcesUrl": url_for("expert.mixed_agri_sources"),
        },
        "options": {
            "sources": [
                {
                    "id": source.id,
                    "title": _text(getattr(source, "source_title", None) or ""),
                }
                for source in (sources or [])
            ],
        },
        "formValues": {
            "sourceId": str(selected_source_id or ""),
            "topic": _text(getattr(fact, "topic", None) or ""),
            "region": _text(getattr(fact, "region", None) or ""),
            "factText": _text(getattr(fact, "fact_text", None) or ""),
            "metricValue": _text(getattr(fact, "metric_value", None) or ""),
            "metricUnit": _text(getattr(fact, "metric_unit", None) or ""),
            "metricYear": _text(getattr(fact, "metric_year", None) or ""),
        },
    }

    return _base_bootstrap("expert-mixed-agri-fact-form", "expert", ui, data)


def build_expert_diseases_bootstrap(*, diseases, knowledge_ready_count, reference_scope_labels):
    disease_rows = diseases or []

    ui = _expert_shell_ui(
        eyebrow=t("diagnosis_knowledge_manager"),
        title=t("diagnosis_knowledge_manager"),
        subtitle=t("diagnosis_knowledge_manager_sub"),
        actions={
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard")},
            "create": {"label": t("add_diagnosis_knowledge"), "href": url_for("expert.create_disease")},
        },
    )
    ui["metrics"] = {
        "total": t("total_diagnosis_entries"),
        "totalMeta": t("knowledge_entries"),
        "totalAccent": _copy("Entries"),
        "ready": t("knowledge_ready_entries"),
        "readyMeta": t("diagnosis_knowledge"),
        "readyAccent": _copy("Ready"),
    }
    ui["sections"] = {
        "entries": t("knowledge_entries"),
        "entriesSubtitle": t("knowledge_entries_count", count=len(disease_rows)),
        "bulkActions": t("bulk_action"),
    }
    ui["labels"] = {
        "bulkAction": t("bulk_action"),
        "deleteSelected": t("delete_selected"),
        "apply": t("apply"),
        "applyToListedEntries": t("apply_to_listed_entries"),
        "selectAll": _copy("Select all"),
        "crop": t("crop_label"),
        "diagnosis": t("diagnosis_name_taxonomy"),
        "cause": t("cause_explanation"),
        "treatmentPrevention": t("treatment_prevention"),
        "referencesImage": t("references_image"),
        "actions": t("actions"),
        "severity": t("severity"),
        "category": t("category"),
        "subCategory": t("sub_category"),
        "scope": t("scope"),
        "treatment": t("treatment"),
        "preventionTips": t("prevention_tips"),
        "notSet": t("not_set"),
        "references": t("references"),
        "noReferences": t("no_references"),
        "image": t("image"),
        "noImage": t("no_image"),
        "visualInputNotes": t("visual_input_notes"),
        "manage": t("manage"),
        "delete": t("delete"),
        "deleteConfirm": t("delete_diagnosis_knowledge_confirm"),
        "noEntries": t("no_diagnosis_knowledge_entries_found"),
        "selected": _copy("Selected"),
        "allListed": _copy("All listed"),
        "bulkActionRequired": _copy("Select a bulk action first."),
        "selectAtLeastOne": _copy("Select at least one diagnosis knowledge entry."),
        "bulkDeleteConfirm": _copy("Delete the selected diagnosis knowledge entries?"),
        "bulkDeleteAllConfirm": _copy("Delete all listed diagnosis knowledge entries?"),
    }

    data = {
        "metrics": {
            "totalCount": len(disease_rows),
            "knowledgeReadyCount": int(knowledge_ready_count or 0),
        },
        "links": {
            "knowledgeUrl": url_for("expert.knowledge_dashboard"),
            "createUrl": url_for("expert.create_disease"),
            "bulkActionUrl": url_for("expert.diseases_bulk"),
        },
        "diseases": [
            {
                "id": disease.id,
                "cropName": _localize_attr(disease.crop, "name", "-"),
                "name": _localize_attr(disease, "name", getattr(disease, "name", "")),
                "severityLabel": _severity_label(getattr(disease, "severity_level", None)),
                "agricultureCategory": _text(getattr(disease, "agriculture_category", None) or ""),
                "agricultureSubCategory": _text(getattr(disease, "agriculture_sub_category", None) or ""),
                "referenceScopeLabel": _text(reference_scope_labels.get(getattr(disease, "reference_scope", None), getattr(disease, "reference_scope", None) or "")),
                "causeExplanation": _text(getattr(disease, "cause_explanation", None) or ""),
                "treatment": _text(getattr(disease, "treatment", None) or ""),
                "preventionTips": _text(getattr(disease, "prevention_tips", None) or ""),
                "hasReferences": bool(getattr(disease, "reference_links", None)),
                "hasImage": bool(getattr(disease, "knowledge_image_data", None)),
                "hasVisualNotes": bool(getattr(disease, "visual_input_notes", None)),
                "editUrl": url_for("expert.edit_disease", disease_id=disease.id),
                "deleteAction": url_for("expert.delete_disease", disease_id=disease.id),
            }
            for disease in disease_rows
        ],
    }

    return _base_bootstrap("expert-diseases", "expert", ui, data)


def build_expert_disease_form_bootstrap(
    *,
    crops,
    back_url,
    disease=None,
    edit_mode=False,
    agriculture_categories=None,
    sub_category_map=None,
    reference_scopes=None,
):
    page_title = t("edit_diagnosis_knowledge") if edit_mode else t("add_diagnosis_knowledge")

    ui = _expert_shell_ui(
        eyebrow=page_title,
        title=page_title,
        subtitle=_copy("Complete the structured diagnosis knowledge fields used by the expert workflow."),
        actions={
            "list": {"label": t("diagnosis_knowledge"), "href": url_for("expert.diseases")},
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard")},
        },
    )
    ui["sections"] = {
        "form": t("diagnosis_knowledge_manager"),
        "formSubtitle": _copy("Capture taxonomy, treatment, prevention, and evidence details in one place."),
        "media": t("reference_image"),
        "mediaSubtitle": t("knowledge_image_hint"),
    }
    ui["labels"] = {
        "back": t("back"),
        "crop": t("crop_label"),
        "selectCrop": t("select_crop"),
        "diagnosisName": t("diagnosis_name"),
        "diagnosisPlaceholder": t("disease_example_placeholder"),
        "diseaseNameKh": t("disease_name_kh"),
        "severityLevel": t("severity_level"),
        "agricultureCategory": t("agriculture_category"),
        "agricultureCategoryHint": t("agriculture_category_hint"),
        "agricultureCategoryExample": t("agriculture_category_example"),
        "subCategory": t("sub_category"),
        "subCategoryHint": t("sub_category_hint"),
        "subCategoryExample": t("sub_category_example"),
        "cropReferenceScope": t("crop_reference_scope"),
        "selectScope": t("select_scope"),
        "referenceScopeHint": t("reference_scope_hint"),
        "visualInputNotes": t("visual_input_notes"),
        "visualInputNotesHint": t("visual_input_notes_hint"),
        "visualInputNotesPlaceholder": t("visual_input_notes_placeholder"),
        "causeExplanation": t("cause_explanation"),
        "causeExplanationPlaceholder": t("cause_explanation_placeholder"),
        "causeExplanationRequiredHint": t("cause_explanation_required_hint"),
        "symptomsDescription": t("symptoms_description"),
        "descriptionPlaceholder": t("description_placeholder"),
        "symptomsDescriptionKh": t("symptoms_description_kh"),
        "stepByStepTreatment": t("step_by_step_treatment"),
        "treatmentPlaceholder": t("treatment_steps_placeholder"),
        "treatmentRequiredHint": t("treatment_required_hint"),
        "treatmentKh": t("treatment_kh"),
        "preventionTips": t("prevention_tips"),
        "preventionPlaceholder": t("prevention_tips_placeholder"),
        "preventionRequiredHint": t("prevention_required_hint"),
        "references": t("references"),
        "referencesPlaceholder": t("references_placeholder"),
        "referenceOnePerLineHint": t("reference_one_per_line_hint"),
        "referenceImage": t("reference_image"),
        "uploadImage": t("upload_image"),
        "knowledgeImageHint": t("knowledge_image_hint"),
        "diagnosisKnowledgeImageAlt": t("diagnosis_knowledge_image_alt"),
        "removeExistingImage": t("remove_existing_image"),
        "updateKnowledge": t("update_knowledge"),
        "saveKnowledge": t("save_knowledge"),
        "cancel": t("cancel"),
    }

    data = {
        "editMode": bool(edit_mode),
        "formAction": request.path,
        "backUrl": _text(back_url),
        "links": {
            "knowledgeUrl": url_for("expert.knowledge_dashboard"),
            "listUrl": url_for("expert.diseases"),
        },
        "currentImageUrl": (
            url_for("expert.disease_knowledge_image", disease_id=disease.id)
            if disease is not None and getattr(disease, "knowledge_image_data", None)
            else None
        ),
        "options": {
            "crops": [
                {"id": crop.id, "name": _localize_attr(crop, "name", getattr(crop, "name", ""))}
                for crop in (crops or [])
            ],
            "categories": [
                {"id": item.get("id"), "label": _text(item.get("label") or "")}
                for item in (agriculture_categories or [])
                if isinstance(item, dict)
            ],
            "subCategoryMap": {
                str(key): [_text(label) for label in (value or []) if label]
                for key, value in (sub_category_map or {}).items()
            },
            "referenceScopes": [
                {"id": item.get("id"), "label": _text(item.get("label") or "")}
                for item in (reference_scopes or [])
                if isinstance(item, dict)
            ],
            "severityLevels": [
                {"id": "Low", "label": t("severity_low")},
                {"id": "Medium", "label": t("severity_medium")},
                {"id": "High", "label": t("severity_high")},
                {"id": "Critical", "label": t("severity_critical")},
            ],
        },
        "formValues": {
            "cropId": str(getattr(disease, "crop_id", "") or ""),
            "name": _text(getattr(disease, "name", None) or ""),
            "nameKh": _text(getattr(disease, "name_kh", None) or ""),
            "severityLevel": _text(getattr(disease, "severity_level", None) or "Low"),
            "agricultureCategory": _text(getattr(disease, "agriculture_category", None) or ""),
            "agricultureSubCategory": _text(getattr(disease, "agriculture_sub_category", None) or ""),
            "referenceScope": _text(getattr(disease, "reference_scope", None) or ""),
            "visualInputNotes": _text(getattr(disease, "visual_input_notes", None) or ""),
            "causeExplanation": _text(getattr(disease, "cause_explanation", None) or ""),
            "description": _text(getattr(disease, "description", None) or ""),
            "descriptionKh": _text(getattr(disease, "description_kh", None) or ""),
            "treatment": _text(getattr(disease, "treatment", None) or ""),
            "treatmentKh": _text(getattr(disease, "treatment_kh", None) or ""),
            "preventionTips": _text(getattr(disease, "prevention_tips", None) or ""),
            "referenceLinks": _text(getattr(disease, "reference_links", None) or ""),
        },
    }

    return _base_bootstrap("expert-disease-form", "expert", ui, data)


def build_expert_optional_form_bootstrap(
    *,
    agriculture_categories=None,
    sub_category_map=None,
    reference_scopes=None,
    form_values=None,
):
    values = form_values or {}

    ui = _expert_shell_ui(
        eyebrow=t("expert_knowledge_input"),
        title=t("expert_knowledge_input"),
        subtitle=_copy("Capture quick expert knowledge and save it into the rule base."),
        actions={
            "knowledge": {"label": t("knowledge_base"), "href": url_for("expert.knowledge_dashboard")},
            "dashboard": {"label": t("dashboard"), "href": url_for("expert.dashboard")},
        },
    )
    ui["sections"] = {
        "form": t("expert_form"),
        "formSubtitle": _copy("Add crop, disease, symptoms, and treatment guidance in a lightweight expert workflow."),
        "summary": _copy("Knowledge summary"),
        "summarySubtitle": _copy("Preview the taxonomy inputs before saving."),
    }
    ui["labels"] = {
        "cropName": t("crop_name"),
        "cropExample": t("crop_example"),
        "diseaseName": t("disease_name"),
        "diseaseExample": t("disease_example_placeholder"),
        "agricultureCategory": t("agriculture_category"),
        "agricultureCategoryHint": t("agriculture_category_hint"),
        "agricultureCategoryExample": t("agriculture_category_example"),
        "subCategory": t("sub_category"),
        "subCategoryHint": t("sub_category_hint"),
        "subCategoryExample": t("sub_category_example"),
        "cropReferenceScope": t("crop_reference_scope"),
        "selectScope": t("select_scope"),
        "referenceScopeHint": t("reference_scope_hint"),
        "symptoms": t("symptoms_label"),
        "symptomsPlaceholder": t("description_placeholder"),
        "visualInputNotes": t("visual_input_notes"),
        "visualInputNotesHint": t("visual_input_notes_hint"),
        "visualInputNotesPlaceholder": t("visual_input_notes_placeholder"),
        "treatment": t("treatment"),
        "solutionPlaceholder": t("expert_solution_placeholder"),
        "saveKnowledge": t("save_knowledge"),
        "cancel": t("cancel"),
        "knowledgeBase": t("knowledge_base"),
        "dashboard": t("dashboard"),
    }

    data = {
        "formAction": request.path,
        "backUrl": url_for("expert.dashboard"),
        "links": {
            "knowledgeUrl": url_for("expert.knowledge_dashboard"),
            "dashboardUrl": url_for("expert.dashboard"),
        },
        "options": {
            "categories": [
                {"id": item.get("id"), "label": _text(item.get("label") or "")}
                for item in (agriculture_categories or [])
                if isinstance(item, dict)
            ],
            "subCategoryMap": {
                str(key): [_text(label) for label in (value or []) if label]
                for key, value in (sub_category_map or {}).items()
            },
            "referenceScopes": [
                {"id": item.get("id"), "label": _text(item.get("label") or "")}
                for item in (reference_scopes or [])
                if isinstance(item, dict)
            ],
        },
        "formValues": {
            "cropName": _text(values.get("crop_name") or values.get("cropName") or ""),
            "diseaseName": _text(values.get("disease_name") or values.get("diseaseName") or ""),
            "agricultureCategory": _text(values.get("agriculture_category") or values.get("agricultureCategory") or ""),
            "agricultureSubCategory": _text(values.get("agriculture_sub_category") or values.get("agricultureSubCategory") or ""),
            "referenceScope": _text(values.get("reference_scope") or values.get("referenceScope") or ""),
            "symptoms": _text(values.get("symptoms") or ""),
            "visualInputNotes": _text(values.get("visual_input_notes") or values.get("visualInputNotes") or ""),
            "solution": _text(values.get("solution") or ""),
        },
    }

    return _base_bootstrap("expert-knowledge-input", "expert", ui, data)


def build_expert_pending_diagnoses_bootstrap(*, diagnoses):
    ui = _expert_shell_ui(
        eyebrow=t("pending_diagnoses_title"),
        title=t("pending_diagnoses_title"),
        subtitle=t("cases_waiting_review"),
        actions={
            "dashboard": {"label": t("dashboard"), "href": url_for("expert.dashboard")},
            "chats": {"label": t("farmer_chats"), "href": url_for("expert.farmer_chats")},
        },
    )
    ui["sections"] = {
        "queue": t("pending_queue"),
        "queueSubtitle": t("cases_waiting_review"),
    }
    ui["table"] = {
        "id": t("id_label"),
        "crop": t("crop_header"),
        "symptoms": t("symptoms_header"),
        "farmer": t("farmer_label"),
        "date": t("date"),
        "action": t("action"),
        "review": t("review"),
        "emptyTitle": t("no_pending_diagnoses"),
        "emptyText": _copy("No cases are waiting for review.", "មិនមានករណីកំពុងរង់ចាំការពិនិត្យទេ។"),
    }

    data = {
        "pendingCount": len(diagnoses or []),
        "diagnoses": [
            {
                "id": diagnosis.id,
                "cropName": _localize_attr(diagnosis.crop, "name", diagnosis.crop_name),
                "symptomsText": _text(diagnosis.symptoms or ""),
                "farmerName": _text(getattr(diagnosis.farmer, "full_name", None) or getattr(diagnosis.farmer, "username", None) or t("farmer")),
                "status": _text(diagnosis.status),
                "statusLabel": _status_label(diagnosis.status),
                "createdAt": _iso(diagnosis.created_at),
                "reviewUrl": url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
            }
            for diagnosis in (diagnoses or [])
        ],
    }

    return _base_bootstrap("expert-pending-diagnoses", "expert", ui, data)


def build_expert_review_diagnosis_bootstrap(*, diagnosis):
    disease_label = _localize_attr(diagnosis.disease, "name", diagnosis.disease_name)
    crop_label = _localize_attr(diagnosis.crop, "name", diagnosis.crop_name)
    confidence_percent = round(float(diagnosis.confidence or 0) * 100.0, 1) if diagnosis.confidence is not None else None
    symptom_list = [
        _text(row.strip())
        for row in str(getattr(diagnosis, "symptoms", "") or "").split(",")
        if str(row).strip()
    ]

    ui = _expert_shell_ui(
        eyebrow=t("review_diagnosis"),
        title=t("review_diagnosis"),
        subtitle=t("cases_waiting_review"),
        actions={
            "pending": {"label": t("pending_diagnoses_title"), "href": url_for("expert.pending_diagnoses")},
            "dashboard": {"label": t("dashboard"), "href": url_for("expert.dashboard")},
        },
    )
    ui["sections"] = {
        "information": t("diagnosis_information"),
        "decision": t("expert_decision"),
    }
    ui["labels"] = {
        "case": _copy("Case", "ករណី"),
        "crop": t("crop_label"),
        "farmer": t("farmer_label"),
        "symptoms": t("symptoms_label"),
        "autoDisease": t("auto_disease"),
        "confidence": t("confidence_label"),
        "status": _copy("Status", "ស្ថានភាព"),
        "createdAt": t("date"),
        "category": t("category"),
        "reason": _copy("Reason", "មូលហេតុ"),
        "expertSolution": t("expert_solution"),
        "solutionPlaceholder": t("solution_placeholder"),
        "approveDiagnosis": t("approve_diagnosis"),
        "rejectDiagnosis": t("reject_diagnosis"),
    }

    data = {
        "diagnosis": {
            "id": diagnosis.id,
            "cropLabel": crop_label,
            "farmerName": _text(getattr(diagnosis.farmer, "full_name", None) or getattr(diagnosis.farmer, "username", None) or t("farmer")),
            "symptomsText": _text(diagnosis.symptoms or ""),
            "symptomList": symptom_list,
            "diseaseLabel": disease_label,
            "confidencePercent": confidence_percent,
            "status": _text(diagnosis.status),
            "statusLabel": _status_label(diagnosis.status),
            "createdAt": _iso(diagnosis.created_at),
            "categoryLabel": _diagnosis_category_label(getattr(diagnosis, "diagnosis_category", None)),
            "reasonText": _text(diagnosis.diagnosis_reason or ""),
            "solutionDraft": _text(diagnosis.solution or ""),
        },
        "formAction": url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
        "dashboardUrl": url_for("expert.dashboard"),
    }

    return _base_bootstrap("expert-review-diagnosis", "expert", ui, data)


def build_expert_farmer_chats_bootstrap(*, sessions):
    ui = _expert_shell_ui(
        eyebrow=t("farmer_chats_title"),
        title=t("farmer_chats"),
        subtitle=t("farmer_chats_sub"),
        actions={
            "dashboard": {"label": t("dashboard"), "href": url_for("expert.dashboard")},
            "pending": {"label": t("pending_diagnoses_title"), "href": url_for("expert.pending_diagnoses")},
        },
    )
    ui["sections"] = {
        "requests": t("farmer_chat_requests"),
        "requestsSubtitle": t("farmer_chats_sub"),
    }
    ui["labels"] = {
        "search": t("search_chats"),
        "session": t("session"),
        "respond": t("respond_now"),
        "emptyTitle": t("no_farmer_chats"),
        "emptyText": _copy("Farmer chat sessions will appear here.", "សម័យជជែករបស់កសិករនឹងបង្ហាញនៅទីនេះ។"),
    }

    data = {
        "sessionCount": len(sessions or []),
        "sessions": [
            {
                "id": session.id,
                "farmerName": _text(getattr(getattr(session, "farmer", None), "full_name", None) or getattr(getattr(session, "farmer", None), "username", None) or t("farmer")),
                "title": _text(session.title or t("new_chat")),
                "updatedAt": _iso(session.updated_at),
                "replyUrl": url_for("expert.reply_chat_session", session_id=session.id),
            }
            for session in (sessions or [])
        ],
    }

    return _base_bootstrap("expert-farmer-chats", "expert", ui, data)


def build_expert_reply_chat_bootstrap(*, session, messages):
    farmer_name = _text(
        getattr(getattr(session, "farmer", None), "full_name", None)
        or getattr(getattr(session, "farmer", None), "username", None)
        or t("farmer")
    )
    expert_name = _text(getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or t("expert"))

    ui = _expert_shell_ui(
        eyebrow=t("reply_farmer"),
        title=t("expert_farmer_chat"),
        subtitle=_copy("Review the conversation and send expert advice back to the farmer.", "ពិនិត្យការសន្ទនា ហើយផ្ញើការណែនាំពីអ្នកជំនាញទៅកសិករ។"),
        actions={
            "farmerChats": {"label": t("farmer_chats"), "href": url_for("expert.farmer_chats")},
            "dashboard": {"label": t("dashboard"), "href": url_for("expert.dashboard")},
        },
    )
    ui["sections"] = {
        "heroTitle": t("expert_farmer_chat"),
        "heroSubtitle": _copy("Keep the discussion focused, practical, and ready for field action.", "រក្សាការសន្ទនា​ឲ្យច្បាស់ អនុវត្តបាន និងសមស្របសម្រាប់ការងារនៅស្រែ។"),
        "helperText": _copy("Reply with treatment, next checks, or what evidence the farmer should send next.", "ឆ្លើយតបដោយផ្ដល់ការព្យាបាល ការត្រួតពិនិត្យបន្ទាប់ ឬភស្តុតាងដែលកសិករគួរផ្ញើបន្ថែម។"),
        "messages": _copy("Conversation", "ការសន្ទនា"),
        "emptyTitle": t("no_messages_yet"),
        "emptyText": _copy("The conversation is empty. Your next reply will start the thread.", "មិនទាន់មានសារនៅក្នុងការសន្ទនានេះទេ។ ការឆ្លើយតបបន្ទាប់របស់អ្នកនឹងចាប់ផ្តើមខ្សែសារ។"),
        "composerHint": t("type_expert_advice_placeholder"),
        "submit": t("send"),
        "online": _copy("Expert reply", "ការឆ្លើយពីអ្នកជំនាញ"),
        "session": t("session"),
        "farmer": t("farmer_label"),
        "updated": _copy("Updated", "បានកែប្រែ"),
    }

    data = {
        "activeSession": {
            "id": session.id,
            "title": _text(getattr(session, "title", None) or t("new_chat")),
            "farmerName": farmer_name,
            "updatedAt": _iso(getattr(session, "updated_at", None)),
            "postUrl": url_for("expert.reply_chat_session", session_id=session.id),
        },
        "links": {
            "farmerChatsUrl": url_for("expert.farmer_chats"),
            "dashboardUrl": url_for("expert.dashboard"),
        },
        "messages": [
            {
                "id": message.id,
                "sender": _text(getattr(message, "sender", None) or ""),
                "message": _text(getattr(message, "message", None) or ""),
                "createdAt": _iso(getattr(message, "created_at", None)),
                "authorName": farmer_name if getattr(message, "sender", None) == "farmer" else expert_name,
            }
            for message in (messages or [])
        ],
    }

    return _base_bootstrap("expert-reply-chat", "expert", ui, data)


def build_expert_support_hub_bootstrap(
    *,
    total_rule_sessions,
    rule_unique_farmers,
    total_rule_messages,
    last_24h_rule_messages,
    auto_cases,
    crops,
    filter_crop_id,
    filter_status,
    filter_date_from,
    filter_date_to,
    rule_chat_messages,
    rule_farmers,
    chat_date_from,
    chat_date_to,
    chat_keyword,
    chat_farmer_id,
):
    ui = _expert_shell_ui(
        eyebrow=t("support_hub_title"),
        title=t("support_hub_title"),
        subtitle=t("support_hub_sub"),
        actions={
            "openChats": {"label": t("open_chats"), "href": url_for("expert.farmer_chats")},
            "pending": {"label": t("pending_diagnoses_title"), "href": url_for("expert.pending_diagnoses")},
        },
    )
    ui["metrics"] = {
        "ruleSessions": t("rule_sessions"),
        "ruleSessionsMeta": t("rule_sessions_sub"),
        "ruleSessionsAccent": _copy("Rules", "ច្បាប់"),
        "ruleMessages": t("rule_messages"),
        "ruleMessagesMeta": t("rule_messages_sub"),
        "ruleMessagesAccent": _copy("Messages", "សារ"),
        "farmers": t("farmers"),
        "farmersMeta": t("farmers_sub"),
        "farmersAccent": _copy("People", "មនុស្ស"),
        "last24h": t("last_24h"),
        "last24hMeta": t("rule_messages_short"),
        "last24hAccent": _copy("Recent", "ថ្មីៗ"),
    }
    ui["sections"] = {
        "quickAccess": _copy("Quick access", "ចូលដំណើរការលឿន"),
        "chatTools": t("farmer_chats_title"),
        "chatToolsSubtitle": t("farmer_chats_sub"),
        "caseTools": t("rule_cases_title"),
        "caseToolsSubtitle": t("rule_cases_sub"),
        "ruleCases": t("rule_cases_title"),
        "ruleCasesSubtitle": t("rule_cases_filter_sub"),
        "ruleChatMessages": t("rule_chat_messages"),
        "ruleChatMessagesSubtitle": t("rule_chat_messages_sub"),
    }
    ui["labels"] = {
        "crop": t("crop_label"),
        "allCrops": t("all_crops"),
        "status": t("diagnosis_status"),
        "from": t("from"),
        "to": t("to"),
        "applyFilters": t("apply_filters"),
        "reset": t("reset"),
        "review": t("review"),
        "keyword": t("keyword"),
        "searchMessages": t("search_messages"),
        "farmer": t("farmer_label"),
        "allFarmers": t("all_farmers"),
        "session": t("session"),
        "system": t("system_label"),
        "respondNow": t("respond_now"),
        "openChats": t("open_chats"),
        "pendingReview": t("pending_review"),
        "approveReject": t("approve_reject"),
        "knowledgeUpdates": t("knowledge_updates"),
        "knowledgeUpdatesSub": t("knowledge_updates_sub"),
        "chatQueue": t("chat_queue"),
        "chatQueueSub": t("chat_queue_sub"),
        "unknownCrop": t("unknown_crop"),
        "noAutoCases": t("no_auto_cases"),
        "noRuleChatMessages": t("no_rule_chat_messages"),
        "statusAuto": t("status_auto"),
        "statusPending": t("status_pending"),
        "statusApproved": t("status_approved"),
        "statusRejected": t("status_rejected"),
    }

    data = {
        "metrics": {
            "totalRuleSessions": int(total_rule_sessions or 0),
            "ruleUniqueFarmers": int(rule_unique_farmers or 0),
            "totalRuleMessages": int(total_rule_messages or 0),
            "last24hRuleMessages": int(last_24h_rule_messages or 0),
        },
        "links": {
            "farmerChatsUrl": url_for("expert.farmer_chats"),
            "pendingDiagnosesUrl": url_for("expert.pending_diagnoses"),
            "diseasesUrl": url_for("expert.diseases"),
            "supportHubUrl": url_for("expert.support_hub"),
        },
        "filters": {
            "cases": {
                "cropId": str(filter_crop_id or ""),
                "status": _text(filter_status or "AUTO"),
                "dateFrom": _text(filter_date_from or ""),
                "dateTo": _text(filter_date_to or ""),
            },
            "messages": {
                "farmerId": str(chat_farmer_id or ""),
                "keyword": _text(chat_keyword or ""),
                "dateFrom": _text(chat_date_from or ""),
                "dateTo": _text(chat_date_to or ""),
            },
        },
        "filterOptions": {
            "crops": [
                {
                    "id": crop.id,
                    "name": _localize_attr(crop, "name", getattr(crop, "name", "")),
                }
                for crop in (crops or [])
            ],
            "statuses": [
                {"id": "AUTO", "label": t("status_auto")},
                {"id": "PENDING", "label": t("status_pending")},
                {"id": "APPROVED", "label": t("status_approved")},
                {"id": "REJECTED", "label": t("status_rejected")},
            ],
            "farmers": [
                {
                    "id": farmer.id,
                    "name": _text(getattr(farmer, "username", None) or getattr(farmer, "full_name", None) or t("farmer")),
                }
                for farmer in (rule_farmers or [])
            ],
        },
        "quickActions": [
            {
                "title": t("farmer_chats_title"),
                "subtitle": t("respond_now"),
                "href": url_for("expert.farmer_chats"),
                "tone": "chat",
            },
            {
                "title": t("chat_queue"),
                "subtitle": t("chat_queue_sub"),
                "href": url_for("expert.farmer_chats"),
                "tone": "queue",
            },
            {
                "title": t("pending_review"),
                "subtitle": t("approve_reject"),
                "href": url_for("expert.pending_diagnoses"),
                "tone": "review",
            },
            {
                "title": t("knowledge_updates"),
                "subtitle": t("knowledge_updates_sub"),
                "href": url_for("expert.diseases"),
                "tone": "knowledge",
            },
        ],
        "autoCases": [
            {
                "id": diagnosis.id,
                "cropName": _localize_attr(diagnosis.crop, "name", getattr(diagnosis, "crop_name", "")),
                "symptomsText": _text(getattr(diagnosis, "symptoms", "") or ""),
                "createdAt": _iso(getattr(diagnosis, "created_at", None)),
                "reviewUrl": url_for("expert.review_diagnosis", diagnosis_id=diagnosis.id),
                "status": _text(getattr(diagnosis, "status", None) or ""),
                "statusLabel": _status_label(getattr(diagnosis, "status", None)),
            }
            for diagnosis in (auto_cases or [])
        ],
        "ruleChatMessages": [
            {
                "id": message.id,
                "sender": _text(getattr(message, "sender", None) or ""),
                "senderLabel": t("farmer_label") if getattr(message, "sender", None) == "farmer" else t("system_label"),
                "sessionId": getattr(message, "session_id", None),
                "message": _text(getattr(message, "message", None) or ""),
                "createdAt": _iso(getattr(message, "created_at", None)),
            }
            for message in (rule_chat_messages or [])
        ],
    }

    return _base_bootstrap("expert-support-hub", "expert", ui, data)


def build_farmer_dashboard_bootstrap(*, diagnoses, ai_questions, crops):
    diagnosis_rows = []
    total_confidence = 0.0

    for diagnosis in diagnoses or []:
        confidence = float(diagnosis.confidence or 0)
        total_confidence += confidence
        diagnosis_rows.append(
            {
                "id": diagnosis.id,
                "cropName": _localize_attr(diagnosis.crop, "name", diagnosis.crop_name),
                "diseaseName": _localize_attr(diagnosis.disease, "name", diagnosis.disease_name),
                "status": _text(diagnosis.status),
                "statusLabel": _status_label(diagnosis.status),
                "confidence": confidence,
                "createdAt": _iso(diagnosis.created_at),
                "resultUrl": url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
            }
        )

    question_rows = []
    for message, session in ai_questions or []:
        question_rows.append(
            {
                "id": message.id,
                "message": _text(message.message),
                "createdAt": _iso(message.created_at),
                "chatUrl": url_for("farmer.chat", session_id=session.id),
                "title": _text(getattr(session, "title", None) or ""),
            }
        )

    crop_rows = [
        {
            "id": crop.id,
            "name": _localize_attr(crop, "name", getattr(crop, "name", "")),
        }
        for crop in (crops or [])
    ]

    ui = {
        "productName": "AGRI SYSTEM",
        "roleLabel": t("farmer_panel"),
        "eyebrow": t("farmer_panel"),
        "pageTitle": t("farmer_dashboard_title"),
        "pageSubtitle": t("farmer_dashboard_sub"),
        "actions": {
            "diagnose": {"label": t("guided_diagnosis_title"), "href": url_for("farmer.diagnose_rule_based")},
            "chat": {"label": t("ask_expert"), "href": url_for("farmer.chat")},
        },
        "navigation": {
            "sections": [
                {
                    "title": _copy("Workspace", "ផ្ទាំងការងារ"),
                    "items": [
                        {"label": t("farmer_dashboard_title"), "href": url_for("farmer.dashboard"), "description": t("farmer_dashboard_sub")},
                        {"label": t("guided_diagnosis_title"), "href": url_for("farmer.diagnose_rule_based"), "description": t("guided_diagnosis_sub")},
                        {"label": t("instant_scan_title"), "href": f"{url_for('farmer.scan_crop')}?instant=1", "description": t("instant_scan_sub")},
                    ],
                },
                {
                    "title": _copy("History", "ប្រវត្តិ"),
                    "items": [
                        {"label": t("recent_diagnoses_title"), "href": url_for("farmer.diagnosis_history"), "description": _copy("Past diagnosis records", "ប្រវត្តិវិនិច្ឆ័យ")},
                        {"label": t("ask_expert_history"), "href": url_for("farmer.ai_history"), "description": _copy("AI question archive", "សំណួរ AI")},
                        {"label": t("ask_expert_title"), "href": url_for("farmer.chat"), "description": t("ask_expert_sub")},
                    ],
                },
            ],
        },
        "metrics": {
            "diagnoses": t("total_diagnoses"),
            "diagnosesMeta": _copy("All diagnosis records for this farmer.", "កំណត់ត្រាវិនិច្ឆ័យសរុប"),
            "diagnosesAccent": _copy("History", "ប្រវត្តិ"),
            "crops": t("crop_label"),
            "cropsMeta": _copy("Crops available in the workspace.", "ដំណាំដែលអាចប្រើបាន"),
            "cropsAccent": _copy("Crops", "ដំណាំ"),
            "questions": t("ask_expert_history"),
            "questionsMeta": _copy("Recent AI questions and chat sessions.", "សំណួរ AI ថ្មីៗ"),
            "questionsAccent": _copy("AI", "AI"),
            "confidence": _copy("Average confidence", "ភាពជឿជាក់មធ្យម"),
            "confidenceMeta": _copy("Based on current diagnosis records.", "ផ្អែកលើកំណត់ត្រាបច្ចុប្បន្ន"),
            "confidenceAccent": _copy("Signal", "សញ្ញា"),
        },
        "sections": {
            "quickActions": t("quick_actions"),
            "entryTitle": t("quick_actions"),
            "entrySubtitle": t("dashboard_quick_actions_sub"),
            "aiQuestions": t("ask_expert_history"),
            "noAiQuestions": _copy("No recent AI questions yet.", "មិនទាន់មានសំណួរ AI ថ្មីៗទេ។"),
            "questionLabel": _copy("Farmer question", "សំណួរកសិករ"),
            "diagnosisHistory": t("recent_diagnoses_title"),
            "diagnosisHistorySubtitle": _copy("Recent diagnosis records and outcomes.", "កំណត់ត្រាវិនិច្ឆ័យថ្មីៗ"),
            "crops": t("crop_label"),
            "noCrops": _copy("No crops are available yet.", "មិនទាន់មានដំណាំទេ។"),
            "cropHelp": _copy("Ready for diagnosis, scanning, and support flows.", "ត្រៀមសម្រាប់វិនិច្ឆ័យ និងស្កេន។"),
        },
        "entryCards": [
            {"title": t("guided_diagnosis_title"), "description": t("guided_diagnosis_sub"), "href": url_for("farmer.diagnose_rule_based"), "primary": True},
            {"title": t("instant_scan_title"), "description": t("instant_scan_sub"), "href": f"{url_for('farmer.scan_crop')}?instant=1", "primary": False},
            {"title": t("ask_expert_title"), "description": t("ask_expert_sub"), "href": url_for("farmer.chat"), "primary": False},
        ],
        "table": {
            "crop": t("crop_label"),
            "status": _copy("Status", "ស្ថានភាព"),
            "confidence": _copy("Confidence", "ភាពជឿជាក់"),
            "open": _copy("Open", "បើក"),
            "viewResult": _copy("View result", "មើលលទ្ធផល"),
            "emptyTitle": _copy("No diagnosis history", "មិនទាន់មានប្រវត្តិវិនិច្ឆ័យ"),
            "emptyText": t("no_history_yet"),
        },
        "weather": {
            "title": _copy("Weather Intelligence", "ព័ត៌មានអាកាសធាតុឆ្លាតវៃ"),
            "subtitle": _copy("Rain, heat, storm, and wind insights for agricultural decisions.", "ព័ត៌មានភ្លៀង កម្តៅ ព្យុះ និងខ្យល់ សម្រាប់ការសម្រេចចិត្តកសិកម្ម។"),
            "loadingLocation": _copy("Loading location...", "កំពុងកំណត់ទីតាំង..."),
            "loadingWeather": _copy("Waiting for weather update...", "កំពុងរង់ចាំការធ្វើបច្ចុប្បន្នភាពអាកាសធាតុ..."),
            "humidity": _copy("Humidity", "សំណើម"),
            "wind": _copy("Wind", "ខ្យល់"),
            "rain": _copy("Rain", "ភ្លៀង"),
            "analyticsTitle": _copy("Agricultural Analytics", "វិភាគកសិកម្ម"),
            "next24hRain": _copy("Next 24h Rain", "ភ្លៀង 24 ម៉ោង"),
            "maxWind24h": _copy("Max Wind 24h", "ខ្យល់អតិបរមា 24 ម៉ោង"),
            "avgTemp24h": _copy("Avg Temp 24h", "សីតុណ្ហភាពមធ្យម 24 ម៉ោង"),
            "weeklyRain": _copy("Weekly Rain", "បរិមាណភ្លៀងប្រចាំសប្ដាហ៍"),
            "alertsTitle": _copy("Smart Alerts", "ការជូនដំណឹងឆ្លាតវៃ"),
            "startingTitle": _copy("Weather module is starting", "ម៉ូឌុលអាកាសធាតុកំពុងចាប់ផ្តើម"),
            "startingMessage": _copy("Fetching local conditions for your farm location.", "កំពុងទាញយកលក្ខខណ្ឌអាកាសធាតុសម្រាប់ទីតាំងកសិដ្ឋានរបស់អ្នក។"),
            "forecastTitle": _copy("7-Day Forecast", "ព្យាករណ៍ 7 ថ្ងៃ"),
            "recommendTitle": _copy("Farmer Recommendations", "អនុសាសន៍សម្រាប់កសិករ"),
            "recommendLoading": _copy("Recommendations will appear after weather data loads.", "អនុសាសន៍នឹងបង្ហាញបន្ទាប់ពីទិន្នន័យអាកាសធាតុបានផ្ទុក។"),
        },
    }

    data = {
        "totalDiagnoses": len(diagnosis_rows),
        "averageConfidence": round((total_confidence / len(diagnosis_rows)), 1) if diagnosis_rows else 0,
        "diagnoses": diagnosis_rows,
        "aiQuestions": question_rows,
        "crops": crop_rows,
        "weather": {
            "endpoint": url_for("weather_intelligence.weather_summary"),
            "lang": _lang(),
            "fallbackLat": 11.5564,
            "fallbackLon": 104.9282,
            "scriptUrl": url_for("static", filename="js/weather_intelligence.js"),
        },
    }

    return _base_bootstrap("farmer-dashboard", "farmer", ui, data)


def _farmer_navigation_sections():
    return [
        {
            "title": _copy("Workspace"),
            "items": [
                {"label": t("farmer_dashboard_title"), "href": url_for("farmer.dashboard"), "description": t("farmer_dashboard_sub")},
                {"label": t("guided_diagnosis_title"), "href": url_for("farmer.diagnose_rule_based"), "description": t("guided_diagnosis_sub")},
                {"label": t("instant_scan_title"), "href": f"{url_for('farmer.scan_crop')}?instant=1", "description": t("instant_scan_sub")},
            ],
        },
        {
            "title": _copy("History"),
            "items": [
                {"label": t("recent_diagnoses_title"), "href": url_for("farmer.diagnosis_history"), "description": _copy("Past diagnosis records")},
                {"label": t("ask_expert_history"), "href": url_for("farmer.ai_history"), "description": _copy("AI question archive")},
                {"label": t("ask_expert_title"), "href": url_for("farmer.chat"), "description": t("ask_expert_sub")},
            ],
        },
    ]


def _farmer_shell_ui(*, eyebrow: str, title: str, subtitle: str, actions: dict[str, dict[str, str]] | None = None):
    return {
        "productName": "AGRI SYSTEM",
        "roleLabel": t("farmer_panel"),
        "eyebrow": eyebrow,
        "pageTitle": title,
        "pageSubtitle": subtitle,
        "actions": actions or {},
        "navigation": {
            "sections": _farmer_navigation_sections(),
        },
    }


def _split_text_lines(value: str | None) -> list[str]:
    rows = []
    for raw_line in str(value or "").replace("\r", "").split("\n"):
        clean_line = raw_line.strip()
        if not clean_line:
            continue
        normalized = clean_line.lstrip("-*0123456789. ").strip()
        rows.append(normalized or clean_line)
    return rows


def _diagnosis_category_label(value: str | None) -> str:
    normalized = (value or "other").strip().lower()
    mapping = {
        "symptoms": t("qb_category_symptoms"),
        "pests": t("qb_category_pests"),
        "diseases": t("qb_category_diseases"),
        "environment": t("qb_category_environment"),
        "fungal": _copy("Fungal disease"),
        "bacterial": _copy("Bacterial disease"),
        "viral": _copy("Viral disease"),
        "pest": _copy("Pest / insect"),
        "nutrient": _copy("Nutrient deficiency"),
    }
    return _text(mapping.get(normalized, t("category_other")))


def _confidence_tier_label(value: str | None) -> str:
    normalized = (value or "insufficient").strip().lower()
    mapping = {
        "high": t("confidence_tier_high"),
        "medium": t("confidence_tier_medium"),
        "low": t("confidence_tier_low"),
        "insufficient": t("confidence_tier_insufficient"),
    }
    return _text(mapping.get(normalized, t("confidence_tier_insufficient")))


def build_farmer_chat_bootstrap(*, sessions, active_session, messages):
    ui = _farmer_shell_ui(
        eyebrow=t("ask_expert"),
        title=_text(getattr(active_session, "title", None) or t("ask_agri_expert")),
        subtitle=t("expert_guidance"),
        actions={
            "newChat": {"label": t("new_chat"), "href": url_for("farmer.new_chat")},
            "diagnose": {"label": t("guided_diagnosis_title"), "href": url_for("farmer.diagnose_rule_based")},
        },
    )
    ui["sections"] = {
        "heroTitle": t("ask_expert_title"),
        "heroSubtitle": t("ask_expert_sub"),
        "history": t("chat_history"),
        "messages": t("messages_label"),
        "emptyTitle": t("ask_expert_title"),
        "emptyText": t("ask_expert_sub"),
        "example": t("use_example"),
        "diagnose": t("diagnose_now"),
        "composerHint": t("ask_expert_placeholder"),
        "submit": t("send"),
        "helperText": t("chat_need_crop_and_symptoms"),
        "assistant": t("farmer_expert"),
        "online": t("ai_online"),
    }

    data = {
        "newChatUrl": url_for("farmer.new_chat"),
        "diagnoseUrl": url_for("farmer.diagnose_rule_based"),
        "exampleMessage": t("ai_help_example"),
        "activeSession": {
            "id": getattr(active_session, "id", None),
            "title": _text(getattr(active_session, "title", None) or t("new_chat")),
            "postUrl": url_for("farmer.chat", session_id=active_session.id) if active_session else url_for("farmer.chat"),
        },
        "sessions": [
            {
                "id": session.id,
                "title": _text(getattr(session, "title", None) or t("new_chat")),
                "href": url_for("farmer.chat", session_id=session.id),
                "updatedAt": _iso(getattr(session, "updated_at", None)),
                "active": bool(active_session and session.id == active_session.id),
            }
            for session in (sessions or [])
        ],
        "messages": [
            {
                "id": message.id,
                "sender": _text(message.sender),
                "message": _text(message.message),
                "createdAt": _iso(message.created_at),
                "authorName": _text(
                    (getattr(current_user, "full_name", None) or getattr(current_user, "username", None) or "User")
                    if getattr(message, "sender", None) == "farmer"
                    else t("farmer_expert")
                ),
            }
            for message in (messages or [])
        ],
    }

    return _base_bootstrap("farmer-chat", "farmer", ui, data)


def build_farmer_diagnose_bootstrap(
    *,
    crops,
    diagnoses,
    symptoms_by_crop,
    crop_profiles,
    agri_domains,
    diagnosis_categories,
    scan_mode,
    instant_scan_mode,
    initial_crop_id,
    domain_default_diagnosis_category,
):
    if instant_scan_mode:
        page_title = t("instant_scan_title")
        page_subtitle = t("instant_scan_sub")
    elif scan_mode:
        page_title = t("scan_crop_mode_title")
        page_subtitle = t("scan_crop_mode_sub")
    else:
        page_title = t("guided_diagnosis_title")
        page_subtitle = t("guided_diagnosis_sub")

    crop_rows = []
    for crop in (crops or []):
        profile = (crop_profiles or {}).get(crop.id, {})
        crop_rows.append(
            {
                "id": crop.id,
                "name": _text(profile.get("name") or getattr(crop, "name", "")),
                "domainId": _text(profile.get("domain_id") or "crop"),
                "subcategoryId": _text(profile.get("subcategory_id") or ""),
            }
        )

    history_rows = [
        {
            "id": diagnosis.id,
            "cropName": _localize_attr(diagnosis.crop, "name", diagnosis.crop_name),
            "diseaseName": _localize_attr(diagnosis.disease, "name", diagnosis.disease_name),
            "status": _text(diagnosis.status),
            "statusLabel": _status_label(diagnosis.status),
            "resultUrl": url_for("farmer.diagnosis_result", diagnosis_id=diagnosis.id),
        }
        for diagnosis in (diagnoses or [])
    ]

    ui = _farmer_shell_ui(
        eyebrow=_text(page_title),
        title=_text(page_title),
        subtitle=_text(page_subtitle),
        actions={
            "dashboard": {"label": t("dashboard"), "href": url_for("farmer.dashboard")},
            "chat": {"label": t("ask_expert"), "href": url_for("farmer.chat")},
        },
    )
    ui["sections"] = {
        "stepContext": t("wizard_set_diagnosis_context"),
        "stepSymptoms": t("wizard_review_symptoms"),
        "stepImage": t("wizard_add_image"),
        "stepReview": t("wizard_review_submit"),
        "stepScan": t("wizard_capture_and_diagnose"),
        "history": t("recent_diagnoses_title"),
        "historyEmptyTitle": _copy("No recent diagnoses"),
        "historyEmptyText": t("no_history_yet"),
    }
    ui["labels"] = {
        "wizardStep": t("wizard_step"),
        "wizardChooseCrop": t("wizard_choose_crop"),
        "wizardDiagnosisContext": t("wizard_diagnosis_context"),
        "wizardStepContextSub": t("wizard_step_context_sub"),
        "wizardStepCropSub": t("wizard_step_crop_sub"),
        "wizardContextNote": t("wizard_context_note"),
        "wizardCropScanNote": t("wizard_crop_scan_note"),
        "wizardReviewSymptomsSub": t("wizard_review_symptoms_sub"),
        "wizardStepImageSubScan": t("wizard_step_image_sub_scan"),
        "wizardStepImageSubManual": t("wizard_step_image_sub_manual"),
        "wizardScanAutoNote": t("wizard_scan_auto_note"),
        "wizardReviewSubmitSub": t("wizard_review_submit_sub"),
        "category": t("category"),
        "type": t("type"),
        "crop": t("crop_label"),
        "selectCrop": t("select_crop"),
        "symptoms": t("symptoms_label"),
        "searchSymptom": t("search_symptom"),
        "freeTextNotes": t("free_text_notes_label"),
        "image": t("image"),
        "fieldImage": t("field_image"),
        "fieldImageScan": t("field_image_scan"),
        "required": t("required_label"),
        "optional": t("optional"),
        "notAdded": t("not_added"),
        "selectedSymptoms": t("selected_symptoms"),
        "noManualSelectionYet": t("no_manual_selection_yet"),
        "noSymptoms": t("no_symptoms_for_crop"),
        "selectedCount": t("selected_count"),
        "selectedSummary": t("selected_symptoms_summary"),
        "more": t("more"),
        "review": t("review"),
        "back": t("back"),
        "cancel": t("cancel"),
        "continueToSymptoms": t("wizard_continue_to_symptoms"),
        "continueToImage": t("wizard_continue_to_image"),
        "continueToReview": t("wizard_continue_to_review"),
        "continueToScan": t("wizard_continue_to_scan"),
        "diagnoseNow": t("diagnose_now"),
        "analyzeScan": t("analyze_scan"),
        "scanAnalyzing": t("scan_analyzing"),
        "scanSuggestionApplied": t("scan_suggestion_applied"),
        "scanSuggestionNone": t("scan_suggestion_none"),
        "scanApiUnavailable": t("scan_api_unavailable"),
        "scanApiFailed": t("scan_api_failed"),
        "scanImageRequired": t("scan_image_required"),
        "invalidImageType": t("invalid_image_type"),
        "pleaseSelectCrop": t("please_select_crop"),
        "pleaseSelectSymptom": t("please_select_symptom"),
        "general": t("general"),
        "selected": t("selected_label"),
        "ready": t("ready_label"),
        "maxUploadSize": t("max_upload_size"),
        "noSymptomsMatch": t("no_symptoms_match"),
        "selectCropToLoadSymptoms": t("select_crop_to_load_symptoms"),
        "scanAutoSubmitting": t("scan_auto_submitting"),
        "cameraLiveLabel": t("camera_live_label"),
        "cameraLiveSub": t("camera_live_sub"),
        "cameraOpen": t("camera_open"),
        "cameraStop": t("camera_stop"),
        "cameraCapture": t("camera_capture"),
        "cameraRetake": t("camera_retake"),
        "cameraSwitch": t("camera_switch"),
        "cameraReady": t("camera_live_hint"),
        "cameraCaptured": t("camera_success"),
        "cameraUnsupported": t("camera_not_supported"),
        "cameraSecureContext": t("camera_https_required"),
        "cameraUnavailable": t("camera_unavailable"),
    }

    data = {
        "postUrl": url_for(
            "farmer.diagnose_rule_based",
            scan="1" if scan_mode else None,
            instant="1" if instant_scan_mode else None,
        ),
        "dashboardUrl": url_for("farmer.dashboard"),
        "historyUrl": url_for("farmer.diagnosis_history"),
        "scanSuggestionApi": url_for("farmer.scan_symptom_suggestions_api"),
        "scanMode": bool(scan_mode),
        "instantScanMode": bool(instant_scan_mode),
        "initialCropId": _text(initial_crop_id or ""),
        "wizardTotalSteps": 2 if instant_scan_mode else 4,
        "agriDomains": agri_domains or [],
        "diagnosisCategories": diagnosis_categories or [],
        "domainDefaultDiagnosisCategory": domain_default_diagnosis_category or {},
        "crops": crop_rows,
        "symptomsByCrop": symptoms_by_crop or {},
        "recentDiagnoses": history_rows[:6],
    }

    return _base_bootstrap("farmer-diagnose", "farmer", ui, data)


def build_farmer_result_bootstrap(*, diagnosis, possible_diseases, symptom_breakdown):
    evidence = diagnosis.diagnosis_evidence if isinstance(diagnosis.diagnosis_evidence, dict) else {}
    knowledge = evidence.get("knowledge", {}) if isinstance(evidence, dict) else {}
    ranked_candidates = evidence.get("ranked_candidates", []) if isinstance(evidence, dict) else []
    confidence_percent = round(float(diagnosis.confidence or 0) * 100.0, 1) if diagnosis.confidence is not None else None

    disease_label = _localize_attr(diagnosis.disease, "name", diagnosis.disease_name)
    crop_label = _localize_attr(diagnosis.crop, "name", diagnosis.crop_name)

    knowledge_cause = None
    if diagnosis.disease and getattr(diagnosis.disease, "cause_explanation", None):
        knowledge_cause = diagnosis.disease.cause_explanation
    elif isinstance(knowledge, dict):
        knowledge_cause = knowledge.get("cause_explanation")

    cause_text = _text(knowledge_cause or diagnosis.diagnosis_reason or t("cause_explanation_unavailable"))

    treatment_source = diagnosis.solution
    if not treatment_source and diagnosis.disease:
        if _lang() == "km" and getattr(diagnosis.disease, "treatment_kh", None):
            treatment_source = diagnosis.disease.treatment_kh
        else:
            treatment_source = getattr(diagnosis.disease, "treatment", None)
    if not treatment_source and isinstance(knowledge, dict):
        treatment_source = knowledge.get("treatment_steps")

    prevention_source = diagnosis.prevention_recommendations
    if not prevention_source and diagnosis.disease:
        prevention_source = getattr(diagnosis.disease, "prevention_tips", None)

    treatment_steps = _split_text_lines(treatment_source)
    prevention_tips = _split_text_lines(prevention_source)
    if not prevention_tips and isinstance(knowledge, dict):
        prevention_tips = [_text(item) for item in (knowledge.get("prevention_tips") or []) if item]

    confirmed_symptoms = []
    for raw_symptom in str(getattr(diagnosis, "symptoms", "") or "").split(","):
        clean_symptom = _text(raw_symptom).strip()
        if clean_symptom:
            confirmed_symptoms.append(clean_symptom)

    references = []
    if diagnosis.disease and getattr(diagnosis.disease, "reference_links", None):
        references = [_text(item) for item in str(diagnosis.disease.reference_links).replace("\r", "").split("\n") if str(item).strip()]
    elif isinstance(knowledge, dict):
        references = [_text(item) for item in (knowledge.get("references") or []) if item]

    knowledge_image_url = None
    if diagnosis.disease and getattr(diagnosis.disease, "knowledge_image_data", None):
        knowledge_image_url = url_for("expert.disease_knowledge_image", disease_id=diagnosis.disease.id)

    ui = _farmer_shell_ui(
        eyebrow=t("diagnosis_result_title"),
        title=t("diagnosis_result_title"),
        subtitle=_copy("Review the diagnosis summary, confidence, and next actions."),
        actions={
            "newDiagnosis": {"label": t("new_diagnosis"), "href": url_for("farmer.diagnose_rule_based")},
            "chat": {"label": t("ask_expert"), "href": url_for("farmer.chat")},
        },
    )
    ui["sections"] = {
        "confidence": t("confidence"),
        "cause": t("cause_explanation"),
        "ranking": t("disease_match_ranking"),
        "treatment": t("treatment_steps"),
        "prevention": t("prevention_advice"),
        "references": t("references"),
        "feedback": t("feedback"),
        "history": t("see_all"),
    }
    ui["labels"] = {
        "diagnosis": t("diagnosis_label"),
        "unknownDiagnosis": t("unknown_diagnosis"),
        "confidence": t("confidence"),
        "category": t("category"),
        "symptoms": t("symptoms_label"),
        "confirmedSymptoms": t("confirmed_symptoms_label"),
        "currentConfidence": t("current_confidence_label"),
        "confidenceHelp": t("confidence_help_text"),
        "topSignals": t("top_symptom_signals"),
        "matchPercent": t("match_percent"),
        "tier": t("tier"),
        "recommendedAction": t("recommended_action"),
        "noTreatment": t("no_treatment_steps"),
        "noPrevention": t("no_prevention_advice"),
        "notAvailable": t("not_available"),
        "feedbackQuestion": t("diagnosis_feedback_question"),
        "feedbackHelpful": t("feedback_helpful"),
        "feedbackNotHelpful": t("feedback_not_helpful"),
        "optionalComment": t("optional_comment"),
        "feedbackPlaceholder": t("feedback_comment_placeholder"),
        "submitted": t("submitted"),
        "yourRating": t("your_rating"),
        "newDiagnosis": t("new_diagnosis"),
        "askExpert": t("ask_expert"),
        "more": t("more"),
        "rank": t("rank"),
        "disease": t("disease_label"),
        "matchedSymptoms": t("matched_symptoms_label"),
        "consultExpertBeforeTreatment": t("consult_expert_before_treatment"),
        "referenceImageAlt": t("diagnosis_reference_image_alt"),
        "comment": t("comment"),
        "pending": t("status_pending"),
    }

    data = {
        "diagnosis": {
            "id": diagnosis.id,
            "diseaseLabel": disease_label,
            "cropLabel": crop_label,
            "createdAt": _iso(diagnosis.created_at),
            "status": _text(diagnosis.status),
            "statusLabel": _status_label(diagnosis.status),
            "confidencePercent": confidence_percent,
            "confidenceLevelKey": _text((diagnosis.confidence_level or "insufficient").lower()),
            "confidenceLevelLabel": _confidence_tier_label(diagnosis.confidence_level),
            "categoryLabel": _diagnosis_category_label(diagnosis.diagnosis_category),
            "confirmedSymptoms": confirmed_symptoms,
            "causeText": cause_text,
            "treatmentSteps": treatment_steps,
            "preventionTips": prevention_tips,
            "references": references,
            "knowledgeImageUrl": knowledge_image_url,
            "feedbackRating": _text(diagnosis.feedback_rating or ""),
            "feedbackComment": _text(diagnosis.feedback_comment or ""),
            "feedbackSubmittedAt": _iso(diagnosis.feedback_submitted_at),
            "feedbackUrl": url_for("farmer.diagnosis_feedback", diagnosis_id=diagnosis.id),
        },
        "symptomBreakdown": symptom_breakdown or [],
        "rankedCandidates": [
            {
                "diseaseName": _text(candidate.get("disease_name") or t("unknown_diagnosis")),
                "matchedSymptoms": [_text(item) for item in (candidate.get("matched_symptoms") or []) if item],
                "matchPercent": round(float(candidate.get("confidence_percent") or 0.0), 1),
                "tierKey": _text(candidate.get("confidence_tier") or "insufficient"),
                "tierLabel": _confidence_tier_label(candidate.get("confidence_tier")),
                "treatment": _text(candidate.get("treatment") or t("consult_expert_before_treatment")),
            }
            for candidate in (ranked_candidates or [])
            if isinstance(candidate, dict)
        ],
        "possibleDiseases": [
            {
                "id": disease.id,
                "name": _localize_attr(disease, "name", getattr(disease, "name", "")),
            }
            for disease in (possible_diseases or [])
        ],
        "actions": {
            "newDiagnosisUrl": url_for("farmer.diagnose_rule_based"),
            "chatUrl": url_for("farmer.chat"),
            "historyUrl": url_for("farmer.diagnosis_history"),
        },
    }

    return _base_bootstrap("farmer-result", "farmer", ui, data)
