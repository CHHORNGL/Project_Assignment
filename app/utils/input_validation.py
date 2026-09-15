"""Validate structure and field values; encode untrusted text at output time."""
import re
from urllib.parse import urlsplit

from email_validator import validate_email, EmailNotValidError
from flask import jsonify, request
from werkzeug.exceptions import BadRequest, RequestEntityTooLarge


class InputValidationError(BadRequest):
    def __init__(self, field, message):
        super().__init__(description=message)
        self.field = field


def text_field(data, name, *, minimum=0, maximum=255, required=False, strip=True):
    value = data.get(name, '')
    if not isinstance(value, str):
        raise InputValidationError(name, f'{name} must be text.')
    if strip:
        value = value.strip()
    if len(value) > maximum or len(value) < max(minimum, int(required)):
        raise InputValidationError(name, f'{name} must contain {max(minimum, int(required))}–{maximum} characters.')
    if strip and any(ord(char) < 32 and char not in '\n\r\t' for char in value):
        raise InputValidationError(name, f'{name} contains unsupported control characters.')
    return value


def email_field(data, name='email'):
    value = text_field(data, name, required=True, maximum=255)
    try:
        return validate_email(value, check_deliverability=False).normalized.lower()
    except EmailNotValidError:
        raise InputValidationError(name, 'Enter a valid email address.') from None


def password_field(data, *, new=False, required=True):
    # Passwords are opaque: no normalization, truncation, or HTML sanitization.
    return text_field(data, 'password', minimum=6 if new else 0,
                      maximum=1024, required=required, strip=False)


def code_field(data, name='code'):
    value = text_field(data, name, required=True, maximum=6)
    if not re.fullmatch(r'[0-9]{6}', value):
        raise InputValidationError(name, 'Verification code must be six digits.')
    return value


def boolean_field(data, name):
    value = data.get(name)
    if type(value) is not bool:
        raise InputValidationError(name, f'{name} must be true or false.')
    return value


def positive_integer(data, name):
    value = data.get(name)
    if value is None:
        return None
    if type(value) is not int or not 1 <= value <= 2147483647:
        raise InputValidationError(name, f'{name} must be a positive integer.')
    return value


def string_list(data, name, *, maximum=100, item_length=255):
    value = data.get(name)
    if not isinstance(value, list) or not 1 <= len(value) <= maximum:
        raise InputValidationError(name, f'{name} must contain 1–{maximum} text items.')
    return [text_field({'item': item}, 'item', required=True, maximum=item_length) for item in value]


def safe_next_url(value):
    if not isinstance(value, str) or not value.startswith('/'):
        return None
    if value.startswith('//') or '\\' in value or any(ord(c) < 32 for c in value):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    return value if not parsed.netloc and not parsed.scheme else None


def register_input_validation(app):
    @app.errorhandler(InputValidationError)
    def invalid_input(error):
        try:
            from app.utils.audit import audit_log
            audit_log(
                "SECURITY_VALIDATION_ERROR",
                detail=f"field={error.field} error={error.description}",
                status="REJECTED",
                severity="WARNING",
            )
        except Exception:
            pass
        return jsonify(error=error.description, message=error.description,
                       code='invalid_input', field=error.field, success=False), 400

    @app.errorhandler(RequestEntityTooLarge)
    def oversized_input(error):
        try:
            from app.utils.audit import audit_log
            audit_log(
                "SECURITY_OVERSIZED_PAYLOAD",
                detail="Request entity too large",
                status="REJECTED",
                severity="WARNING",
            )
        except Exception:
            pass
        return jsonify(error='Request body is too large.', code='request_too_large'), 413

    @app.before_request
    def validate_json_envelope():
        if request.is_json:
            # Flask enforces MAX_CONTENT_LENGTH when reading even without Content-Length.
            try:
                data = request.get_json()
            except BadRequest:
                raise InputValidationError('body', 'Request body must contain valid JSON.') from None
            if not isinstance(data, dict):
                raise InputValidationError('body', 'JSON body must be an object.')


def support_message_fields(data):
    message = text_field(data, 'message', maximum=4000)
    attachment = data.get('attachment_url')
    kind = data.get('attachment_type')
    if attachment is None or attachment == '':
        if not message:
            raise InputValidationError('message', 'Message or attachment is required.')
        return message, None, None
    attachment = text_field(data, 'attachment_url', required=True, maximum=512)
    if kind == 'location':
        if not re.fullmatch(r'-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?', attachment):
            raise InputValidationError('attachment_url', 'Location must contain latitude,longitude.')
        lat, lon = map(float, attachment.split(','))
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise InputValidationError('attachment_url', 'Location is outside valid coordinate ranges.')
    elif kind in ('image', 'audio'):
        if not re.fullmatch(r'/static/uploads/chats/[0-9a-f]{32}\.[a-z0-9]{1,10}', attachment):
            raise InputValidationError('attachment_url', 'Use an attachment uploaded through support chat.')
    else:
        raise InputValidationError('attachment_type', 'Unsupported attachment type.')
    return message, attachment, kind
