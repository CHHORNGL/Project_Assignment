from app import create_app
from flask import render_template_string
app = create_app()
with app.test_request_context('/farmer/diagnose'):
    from flask import g
    from app.utils.i18n import get_current_language
    g.site_language = 'km'
    template = """
    {% set is_km = (current_lang == 'km') %}
    HTML is_km: {{ is_km }}
    JS isKm: {{ 'true' if current_lang == 'km' else 'false' }}
    JS current_lang: {{ current_lang }}
    get function: {{ current_lang() if current_lang is callable else current_lang }}
    """
    print(render_template_string(template))
