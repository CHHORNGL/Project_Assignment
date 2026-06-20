from app import create_app
from app.utils.i18n import set_current_language, get_current_language
from app.extensions import db
from app.models.user import User
from app.models.role import Role
from flask_login import login_user

app = create_app()
with app.app_context():
    set_current_language("km")
    print("Current language set to:", get_current_language())

    farmer_role = Role.query.filter_by(name="farmer").first()
    farmer = User.query.first()

    with app.test_request_context():
        login_user(farmer)
        from app.blueprints.farmer.routes import diagnose_rule_based
        try:
            resp = diagnose_rule_based()
            if isinstance(resp, str):
                html = resp
            else:
                html = resp.get_data(as_text=True)
            
            # Extract script tag with id="diagnosis-wizard-data"
            import re
            match = re.search(r'<script id="diagnosis-wizard-data"[^>]*>(.*?)</script>', html, re.DOTALL)
            if match:
                print("JSON PAYLOAD:")
                print(match.group(1).strip())
            else:
                print("Script tag not found in HTML!")
        except Exception as e:
            import traceback
            traceback.print_exc()
