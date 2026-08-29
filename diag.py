from app import create_app
from flask import render_template
app = create_app()
with app.test_request_context('/farmer/diagnose'):
    from flask import g
    g.site_language = 'km'
    print(render_template("farmer/diagnose.html", crops=[], crop_symptoms={}, diagnoses=[], selected_crop_id=None))
