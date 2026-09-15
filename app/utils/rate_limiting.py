"""Shared request budgets, checked before expensive view functions execute."""
from flask import jsonify, request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# Shared scopes prevent switching between web/mobile endpoints to reset a budget.
AUTH_ENDPOINTS = {
    'auth.login', 'staff.login', 'api.login', 'api.telegram_login_api',
    'api.google_login_api', 'auth.verify_code', 'api.verify_code',
    'auth.passkey_login_verify', 'staff.passkey_login_verify',
    'auth.reset_password',
}
RECOVERY_ENDPOINTS = {
    'auth.register', 'api.register', 'auth.send_register_otp',
    'auth.forgot_password', 'auth.resend_code', 'api.resend_code',
    'auth.reset_password_api', 'api.api_reset_password',
}
EXPENSIVE_ENDPOINTS = {
    'assistant.ask', 'assistant.support', 'api.chat_ask',
    'api.perform_diagnosis', 'api.diagnose_image', 'farmer.chat',
    'farmer.diagnose', 'farmer.diagnose_rule_based',
    'farmer.api_diagnose_live_evaluation',
}


from app.utils.audit import audit_log


def register_rate_limiting(app):
    def exempt_global():
        return request.endpoint in {'static', 'healthz'} or request.method == 'OPTIONS'

    def on_breach(limit):
        audit_log(
            "SECURITY_RATE_LIMIT_EXCEEDED",
            detail=f"endpoint={request.endpoint} limit={limit}",
            status="BLOCKED",
            severity="WARNING",
        )
        response = jsonify(
            error='Too many requests. Please wait before trying again.',
            code='rate_limit_exceeded',
        )
        response.status_code = 429
        return response

    limiter = Limiter(
        key_func=get_remote_address,
        application_limits=[app.config['RATE_LIMIT_GLOBAL']],
        application_limits_exempt_when=exempt_global,
        on_breach=on_breach,
        headers_enabled=True,
        retry_after='delta-seconds',
    )
    limiter.init_app(app)
    for endpoints, setting, scope in (
        (AUTH_ENDPOINTS, 'RATE_LIMIT_AUTH', 'authentication'),
        (RECOVERY_ENDPOINTS, 'RATE_LIMIT_RECOVERY', 'account-recovery'),
        (EXPENSIVE_ENDPOINTS, 'RATE_LIMIT_EXPENSIVE', 'expensive-requests'),
    ):
        shared = limiter.shared_limit(
            app.config[setting], scope=scope, methods=['POST'],
            override_defaults=False,
        )
        for endpoint in endpoints:
            if endpoint in app.view_functions:
                app.view_functions[endpoint] = shared(app.view_functions[endpoint])
    return limiter
