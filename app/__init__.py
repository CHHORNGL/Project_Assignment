from datetime import datetime
import os
import time
from uuid import uuid4
import logging
from logging.handlers import RotatingFileHandler

from flask import Flask, url_for, request, render_template, redirect, g, send_from_directory, has_request_context
from flask_login import current_user

from .extensions import db, login_manager, migrate, oauth
from .config import Config
from app.models.notification import Notification
from app.services.notification_service import serialize_notification
from app.utils.i18n import t, get_current_language, normalize_display_text


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ===============================
    # LOGGING
    # ===============================
    class _RequestContextFilter(logging.Filter):
        def filter(self, record):
            if has_request_context():
                record.request_id = getattr(g, "request_id", "-")
                record.path = getattr(request, "path", "-")
                record.method = getattr(request, "method", "-")
                try:
                    record.user = current_user.username if current_user.is_authenticated else "anonymous"
                except Exception:
                    record.user = "anonymous"
            else:
                record.request_id = "-"
                record.path = "-"
                record.method = "-"
                record.user = "-"
            return True

    try:
        log_dir = os.path.join(app.instance_path, "logs")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "app.log")

        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=1_000_000,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.INFO)
        file_handler.addFilter(_RequestContextFilter())
        file_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s [%(request_id)s] %(method)s %(path)s user=%(user)s %(message)s"
            )
        )
        app.logger.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.propagate = False
    except Exception:
        # Logging must never prevent the app from starting.
        pass

    # ===============================
    # INIT EXTENSIONS
    # ===============================
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    def _infer_login_role(path: str) -> str:
        if path.startswith("/admin") or path.startswith("/expert"):
            return "expert"
        return "farmer"

    def _safe_next_url(value):
        if value and value.startswith("/"):
            return value
        return None

    @login_manager.unauthorized_handler
    def _unauthorized():
        role = _infer_login_role(request.path or "")
        next_url = request.full_path or request.path
        if next_url.endswith("?"):
            next_url = request.path
        next_url = _safe_next_url(next_url)
        if next_url:
            return redirect(url_for("auth.login", role=role, next=next_url))
        return redirect(url_for("auth.login", role=role))

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
    from app.blueprints.assistant.routes import assistant_bp
    from app.blueprints.expert.routes import expert_bp
    from app.blueprints.farmer.routes import farmer_bp
    from app.blueprints.weather_intelligence.routes import weather_intelligence_bp
    from app.blueprints.user.routes import user_bp

    # Main & Auth
    app.register_blueprint(main_bp)     # /
    app.register_blueprint(auth_bp)     # /auth

    # Role-based Blueprints
    app.register_blueprint(admin_bp)    # /admin/...
    app.register_blueprint(admin_crop_bp)  # /admin/crops/...
    app.register_blueprint(assistant_bp)  # /assistant/...
    app.register_blueprint(expert_bp)   # /expert/...
    app.register_blueprint(farmer_bp)   # /farmer/...
    app.register_blueprint(weather_intelligence_bp)  # /weather-intelligence/...
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
        request_id = getattr(g, "request_id", uuid4().hex[:12])
        return (
            render_template(
                "errors/404.html",
                error_code=404,
                error_title="Page not found",
                error_message="The page you are looking for does not exist.",
                request_path=request.path,
                request_method=request.method,
                referrer=request.referrer,
                request_id=request_id,
                timestamp=datetime.utcnow(),
                user_label=current_user.username if current_user.is_authenticated else "Guest",
                home_url=_resolve_home_url(),
            ),
            404,
        )

    @app.errorhandler(405)
    def method_not_allowed(error):
        request_id = getattr(g, "request_id", uuid4().hex[:12])
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
                request_id=request_id,
                timestamp=datetime.utcnow(),
                user_label=current_user.username if current_user.is_authenticated else "Guest",
                home_url=_resolve_home_url(),
                valid_methods=valid_methods,
            ),
            405,
        )

    @app.errorhandler(500)
    def server_error(error):
        request_id = getattr(g, "request_id", uuid4().hex[:12])
        return (
            render_template(
                "errors/500.html",
                error_code=500,
                error_title="Server error",
                error_message="We hit a snag while processing your request. Please try again.",
                request_path=request.path,
                request_method=request.method,
                referrer=request.referrer,
                request_id=request_id,
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
        # Request ID for correlation (also used by client-side reporting).
        rid = (request.headers.get("X-Request-ID") or "").strip()
        if rid:
            g.request_id = rid[:64]
        else:
            g.request_id = uuid4().hex[:12]

        # Ensure database session is clean at the start of each request.
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

    @app.after_request
    def attach_request_id_header(response):
        rid = getattr(g, "request_id", None)
        if rid:
            response.headers.setdefault("X-Request-ID", rid)
        return response

    @app.teardown_request
    def log_unhandled_exceptions(exception=None):
        # Log unexpected exceptions with stack trace; ignore expected HTTP errors.
        if exception is None:
            return
        try:
            from werkzeug.exceptions import HTTPException
            if isinstance(exception, HTTPException):
                return
        except Exception:
            pass
        try:
            app.logger.error(
                "Unhandled exception",
                exc_info=(type(exception), exception, getattr(exception, "__traceback__", None)),
            )
        except Exception:
            pass

    # ===============================
    # HEALTH + SERVICE WORKER + CLIENT LOGS
    # ===============================
    @app.get("/healthz")
    def healthz():
        # Lightweight ping endpoint for offline detection.
        return ("", 204, {"Cache-Control": "no-store"})

    @app.get("/sw.js")
    def sw():
        # Serve service worker at the origin root so it can control all routes.
        resp = send_from_directory(app.static_folder, "sw.js")
        resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        resp.mimetype = "application/javascript"
        return resp

    @app.post("/client-logs")
    def client_logs():
        # Accept client-side error reports (best effort).
        if not request.is_json:
            return ("", 400)
        payload = request.get_json(silent=True) or {}
        try:
            level = str(payload.get("level") or "error").lower()
            msg = str(payload.get("message") or "")[:2000]
            stack = str(payload.get("stack") or "")[:8000]
            url = str(payload.get("url") or "")[:2000]
            ua = str(payload.get("userAgent") or request.headers.get("User-Agent") or "")[:500]

            log_line = f"ClientLog level={level} url={url} msg={msg} ua={ua}"
            if level in {"warning", "warn"}:
                app.logger.warning(log_line)
            else:
                app.logger.error(log_line)
            if stack:
                app.logger.info("ClientLog stack=%s", stack)
        except Exception:
            pass
        return ("", 204)

    # ===============================
    # GLOBAL NOTIFICATIONS (TOPBAR)
    # ===============================
    def _static_version():
        try:
            static_root = os.path.join(app.root_path, "static")
            candidates = [
                os.path.join(static_root, "css", "style.css"),
                os.path.join(static_root, "css", "auth.css"),
                os.path.join(static_root, "css", "notifications.css"),
                os.path.join(static_root, "css", "system_status.css"),
                os.path.join(static_root, "css", "errors.css"),
                os.path.join(static_root, "css", "weather_intelligence.css"),
                os.path.join(static_root, "js", "toast.js"),
                os.path.join(static_root, "js", "system_status.js"),
                os.path.join(static_root, "js", "error_pages.js"),
                os.path.join(static_root, "js", "weather_intelligence.js"),
                os.path.join(static_root, "sw.js"),
            ]
            mtimes = []
            for path in candidates:
                try:
                    if os.path.exists(path):
                        mtimes.append(os.path.getmtime(path))
                except Exception:
                    continue
            if mtimes:
                return int(max(mtimes))
            return int(time.time())
        except Exception:
            return int(time.time())

    @app.context_processor
    def inject_language():
        def localize(obj, field, fallback=None):
            if obj is None:
                return normalize_display_text(fallback or "", lang=get_current_language())
            lang = get_current_language()
            if lang == "km":
                kh_value = getattr(obj, f"{field}_kh", None)
                if kh_value:
                    return normalize_display_text(kh_value, lang=lang)
            value = getattr(obj, field, None)
            if value:
                return normalize_display_text(value, lang=lang)
            return normalize_display_text(fallback or "", lang=lang)

        return {
            "t": t,
            "current_lang": get_current_language(),
            "localize": localize,
            "static_version": _static_version(),
        }

    # Auto-fix Khmer mojibake text in rendered template expressions.
    app.jinja_env.finalize = normalize_display_text

    @app.context_processor
    def inject_avatar_helper():
        def avatar_url(user_obj=None):
            target = user_obj
            if target is None:
                try:
                    if current_user.is_authenticated:
                        target = current_user
                except Exception:
                    target = None
            if target is None:
                return url_for("static", filename="img/avatar.png")
            try:
                return url_for("user.avatar", user_id=target.id)
            except Exception:
                return url_for("static", filename="img/avatar.png")

        return {"avatar_url": avatar_url}

    @app.context_processor
    def inject_notifications():
        if not current_user.is_authenticated:
            return {"notifications": [], "notifications_count": 0, "notifications_link": None}

        notifications = []
        notifications_link = url_for("user.notifications")
        unread_count = 0

        try:
            notifications_query = (
                Notification.query
                .filter(Notification.user_id == current_user.id)
                .order_by(Notification.created_at.desc())
            )
            notifications = [
                serialize_notification(item)
                for item in notifications_query.limit(6).all()
            ]
            unread_count = (
                Notification.query
                .filter(
                    Notification.user_id == current_user.id,
                    Notification.read_at.is_(None),
                )
                .count()
            )
        except Exception as e:
            db.session.rollback()
            print(f"Error generating notifications: {e}")
            notifications = []
            unread_count = 0

        return {
            "notifications": notifications,
            "notifications_count": unread_count,
            "notifications_link": notifications_link,
        }

    @app.context_processor
    def inject_body_class():
        body_class = ""
        try:
            if current_user.is_authenticated:
                path = (request.path or "").lower()
                if path.startswith("/farmer") and current_user.has_role("farmer"):
                    body_class = "farmer-dash-theme"
                elif path.startswith("/admin") and current_user.has_role("admin"):
                    body_class = "admin-theme"
                elif path.startswith("/expert") and current_user.has_role("expert"):
                    body_class = "expert-simple"
                elif current_user.has_role("admin"):
                    body_class = "admin-theme"
                elif current_user.has_role("expert"):
                    body_class = "expert-simple"
                elif current_user.has_role("farmer"):
                    body_class = "farmer-dash-theme"
        except Exception:
            body_class = ""
        return {"body_class": body_class}

    return app
