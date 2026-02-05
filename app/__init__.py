from datetime import datetime
from uuid import uuid4

from flask import Flask, url_for, request, render_template
from flask_login import current_user

from .extensions import db, login_manager, migrate, oauth
from .config import Config
from app.models.audit_log import AuditLog
from app.models.diagnosis import Diagnosis
from app.models.chat_message import ChatMessage
from app.utils.i18n import t, get_current_language


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ===============================
    # INIT EXTENSIONS
    # ===============================
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    # 🔑 IMPORTANT: Flask-Migrate
    migrate.init_app(app, db)

    # ===============================
    # OAUTH (GOOGLE)
    # ===============================
    oauth.init_app(app)
    if app.config.get("GOOGLE_CLIENT_ID") and app.config.get("GOOGLE_CLIENT_SECRET"):
        oauth.register(
            name="google",
            client_id=app.config["GOOGLE_CLIENT_ID"],
            client_secret=app.config["GOOGLE_CLIENT_SECRET"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={
                "scope": "openid email profile"
            },
        )

    # ===============================
    # REGISTER BLUEPRINTS
    # ===============================
    from app.blueprints.main.routes import main_bp
    from app.blueprints.auth.routes import auth_bp
    from app.blueprints.admin.routes import admin_bp
    from app.blueprints.admin.crop_routes import admin_crop_bp
    from app.blueprints.expert.routes import expert_bp
    from app.blueprints.farmer.routes import farmer_bp
    from app.blueprints.user.routes import user_bp

    # Main & Auth
    app.register_blueprint(main_bp)     # /
    app.register_blueprint(auth_bp)     # /auth

    # Role-based Blueprints
    app.register_blueprint(admin_bp)    # /admin/...
    app.register_blueprint(admin_crop_bp)  # /admin/crops/...
    app.register_blueprint(expert_bp)   # /expert/...
    app.register_blueprint(farmer_bp)   # /farmer/...
    app.register_blueprint(user_bp)     # /user/...

    # ===============================
    # ERROR HANDLERS
    # ===============================
    def _resolve_home_url():
        try:
            if current_user.is_authenticated:
                if current_user.has_role("admin"):
                    return url_for("admin.dashboard")
                if current_user.has_role("expert"):
                    return url_for("expert.dashboard")
                if current_user.has_role("farmer"):
                    return url_for("farmer.dashboard")
        except Exception:
            pass
        try:
            return url_for("auth.login")
        except Exception:
            return "/"

    @app.errorhandler(404)
    def not_found(error):
        return (
            render_template(
                "errors/404.html",
                error_code=404,
                error_title="Page not found",
                error_message="The page you are looking for does not exist.",
                request_path=request.path,
                request_method=request.method,
                referrer=request.referrer,
                request_id=uuid4().hex[:8],
                timestamp=datetime.utcnow(),
                user_label=current_user.username if current_user.is_authenticated else "Guest",
                home_url=_resolve_home_url(),
            ),
            404,
        )

    @app.errorhandler(405)
    def method_not_allowed(error):
        valid_methods = sorted(getattr(error, "valid_methods", []) or [])
        return (
            render_template(
                "errors/405.html",
                error_code=405,
                error_title="Method not allowed",
                error_message="This action is not allowed for the requested URL.",
                request_path=request.path,
                request_method=request.method,
                referrer=request.referrer,
                request_id=uuid4().hex[:8],
                timestamp=datetime.utcnow(),
                user_label=current_user.username if current_user.is_authenticated else "Guest",
                home_url=_resolve_home_url(),
                valid_methods=valid_methods,
            ),
            405,
        )

    @app.errorhandler(500)
    def server_error(error):
        return (
            render_template(
                "errors/500.html",
                error_code=500,
                error_title="Server error",
                error_message="Something went wrong on our side. Please try again.",
                request_path=request.path,
                request_method=request.method,
                referrer=request.referrer,
                request_id=uuid4().hex[:8],
                timestamp=datetime.utcnow(),
                user_label=current_user.username if current_user.is_authenticated else "Guest",
                home_url=_resolve_home_url(),
            ),
            500,
        )

    # ===============================
    # REQUEST LIFECYCLE MANAGEMENT
    # ===============================
    @app.before_request
    def before_request():
        """Ensure database session is clean at the start of each request."""
        try:
            # If there's an active but failed transaction, rollback
            if db.session.is_active and db.session.in_transaction():
                db.session.rollback()
        except Exception:
            db.session.rollback()

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """Rollback any failed transactions at the end of request."""
        if exception is not None:
            db.session.rollback()

    # ===============================
    # GLOBAL NOTIFICATIONS (TOPBAR)
    # ===============================
    @app.context_processor
    def inject_language():
        def localize(obj, field, fallback=None):
            if obj is None:
                return fallback or ""
            lang = get_current_language()
            if lang == "km":
                kh_value = getattr(obj, f"{field}_kh", None)
                if kh_value:
                    return kh_value
            value = getattr(obj, field, None)
            if value:
                return value
            return fallback or ""

        return {
            "t": t,
            "current_lang": get_current_language(),
            "localize": localize,
        }

    @app.context_processor
    def inject_notifications():
        if not current_user.is_authenticated:
            return {"notifications": [], "notifications_count": 0, "notifications_link": None}

        def time_ago(dt):
            if not dt:
                return ""
            now = datetime.utcnow()
            diff = now - dt
            seconds = diff.total_seconds()
            if seconds < 60:
                return "Just now"
            if seconds < 3600:
                return f"{int(seconds // 60)}m ago"
            if seconds < 86400:
                return f"{int(seconds // 3600)}h ago"
            if seconds < 172800:
                return "Yesterday"
            return dt.strftime("%b %d")

        notifications = []
        notifications_link = None

        try:
            if current_user.has_role("admin"):
                pending_q = Diagnosis.query.filter_by(status="PENDING")
                pending_count = pending_q.count()
                latest_pending = pending_q.order_by(Diagnosis.created_at.desc()).first()
                if pending_count > 0:
                    notifications.append(
                        {
                            "title": "Pending diagnoses",
                            "subtitle": f"{pending_count} case(s) awaiting review",
                            "time": time_ago(latest_pending.created_at if latest_pending else None),
                            "icon": "fas fa-hourglass-half",
                            "level": "warning",
                            "url": url_for("admin.dashboard"),
                            "time_value": latest_pending.created_at if latest_pending else datetime.utcnow(),
                        }
                    )

                logs = (
                    AuditLog.query
                    .order_by(AuditLog.created_at.desc())
                    .limit(4)
                    .all()
                )
                action_map = {
                    "CREATE_USER": ("fas fa-user-plus", "success", "User created"),
                    "BAN_USER": ("fas fa-user-slash", "danger", "User banned"),
                    "UNBAN_USER": ("fas fa-user-check", "success", "User unbanned"),
                    "CHANGE_ROLE": ("fas fa-user-tag", "info", "Role updated"),
                }
                for log in logs:
                    icon, level, title = action_map.get(
                        log.action,
                        ("fas fa-bell", "info", log.action.replace("_", " ").title())
                    )
                    subtitle_parts = []
                    if log.target_user:
                        subtitle_parts.append(log.target_user)
                    if log.detail:
                        subtitle_parts.append(log.detail)
                    subtitle = " • ".join(subtitle_parts) if subtitle_parts else "System activity"
                    notifications.append(
                        {
                            "title": title,
                            "subtitle": subtitle,
                            "time": time_ago(log.created_at),
                            "icon": icon,
                            "level": level,
                            "url": url_for("admin.audit_logs"),
                            "time_value": log.created_at,
                        }
                    )

                notifications_link = url_for("admin.audit_logs")

            elif current_user.has_role("expert"):
                pending_q = Diagnosis.query.filter_by(status="PENDING")
                pending_count = pending_q.count()
                latest_pending = pending_q.order_by(Diagnosis.created_at.desc()).first()
                if pending_count > 0:
                    notifications.append(
                        {
                            "title": "Pending diagnoses",
                            "subtitle": f"{pending_count} case(s) ready to review",
                            "time": time_ago(latest_pending.created_at if latest_pending else None),
                            "icon": "fas fa-hourglass-half",
                            "level": "warning",
                            "url": url_for("expert.pending_diagnoses"),
                            "time_value": latest_pending.created_at if latest_pending else datetime.utcnow(),
                        }
                    )

                latest_message = (
                    ChatMessage.query
                    .filter_by(sender="farmer")
                    .order_by(ChatMessage.created_at.desc())
                    .first()
                )
                if latest_message:
                    snippet = latest_message.message.strip()
                    if len(snippet) > 60:
                        snippet = snippet[:57] + "..."
                    notifications.append(
                        {
                            "title": "New farmer message",
                            "subtitle": snippet if snippet else "New message received",
                            "time": time_ago(latest_message.created_at),
                            "icon": "fas fa-comment-dots",
                            "level": "info",
                            "url": url_for("expert.farmer_chats"),
                            "time_value": latest_message.created_at,
                        }
                    )

                notifications_link = url_for("expert.farmer_chats")

            notifications.sort(key=lambda n: n.get("time_value") or datetime.min, reverse=True)
            for n in notifications:
                n.pop("time_value", None)

        except Exception as e:
            # Rollback any failed transaction to prevent "current transaction is aborted" errors
            db.session.rollback()
            print(f"Error generating notifications: {e}")
            notifications = []
            notifications_link = None

        return {
            "notifications": notifications,
            "notifications_count": len(notifications),
            "notifications_link": notifications_link,
        }

    return app
