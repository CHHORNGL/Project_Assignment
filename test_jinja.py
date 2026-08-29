from app import create_app
from flask import render_template_string
app = create_app()
with app.test_request_context('/farmer/diagnose'):
    template = """
    const cropsData = {
        {% for crop_id, symptoms in crop_symptoms.items() %}
            "{{ crop_id }}": [
                {% for s in symptoms %}
                    {
                        "id": {{ s.id }},
                        "name": "{{ s.name|escape }}",
                        "name_kh": "{{ (s.name_kh or s.name)|escape }}"
                    }{% if not loop.last %},{% endif %}
                {% endfor %}
            ]{% if not loop.last %},{% endif %}
        {% endfor %}
    };
    """
    from app.blueprints.farmer.routes import _symptom_candidates_for_crop
    crop_symptoms = {1: _symptom_candidates_for_crop(1)[:2]}
    print(render_template_string(template, crop_symptoms=crop_symptoms))
