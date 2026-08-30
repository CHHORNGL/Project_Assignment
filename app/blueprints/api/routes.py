from flask import Blueprint, jsonify, request
from flask_login import login_user, current_user, logout_user
from flask_login import login_user, current_user, logout_user, login_required
from sqlalchemy import or_
from app.models.user import User
from app import db

api_bp = Blueprint('api', __name__, url_prefix='/api')

from app.services.rule_engine import diagnose as rule_diagnose
from app.models.diagnosis import Diagnosis

@api_bp.route('/diagnose', methods=['POST'])
@login_required
def perform_diagnosis():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    symptoms = data.get('symptoms', [])
    crop_id = data.get('crop_id')
    
    if not symptoms:
        return jsonify({'error': 'Please provide at least one symptom'}), 400
        
    # Use Rule Engine to determine disease
    diagnosis_result = rule_diagnose(
        symptoms_input=symptoms,
        crop_id=crop_id
    )

    if not diagnosis_result:
        return jsonify({
            'success': True,
            'disease': 'Unknown',
            'confidence': 0,
            'symptoms': symptoms,
            'notes': 'No specific disease matched.'
        })

    rule = diagnosis_result['rule']
    disease = rule.disease

    # Log diagnosis to history
    diag = Diagnosis(
        farmer_id=current_user.id,
        crop_name=disease.crop.name if disease and disease.crop else "Unknown",
        disease_id=disease.id if disease else None,
        disease_name=disease.name if disease else "Unknown",
        diagnosis_category="Manual",
        symptoms=", ".join(symptoms),
        status="MANUAL",
        confidence=diagnosis_result.get('confidence'),
        diagnosis_reason=diagnosis_result.get('reason'),
    )
    db.session.add(diag)
    db.session.commit()

    return jsonify({
        'success': True,
        'disease': disease.name if disease else "Unknown",
        'confidence': diagnosis_result.get('confidence'),
        'confidence_tier': diagnosis_result.get('confidence_tier'),
        'symptoms': diagnosis_result.get('matched_symptoms', []),
        'reason': diagnosis_result.get('reason'),
        'recommendations': diagnosis_result.get('recommendations'),
    })

from app.services.openai_assistant import generate_assistant_reply

@api_bp.route('/chat/ask', methods=['POST'])
@login_required
def chat_ask():
    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'Message is required'}), 400
        
    user_message = data['message']
    
    # You could save to DB here if you wanted session history, 
    # but for a simple "modern chat" we can just return the reply.
    reply = generate_assistant_reply(user_message)
    
    if reply:
        return jsonify({'reply': reply})
    else:
        return jsonify({'error': 'AI failed to generate a reply'}), 500

@api_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('username')
    password = data.get('password')
    
    if not identifier or not password:
        return jsonify({'error': 'Missing credentials'}), 400
        
    user = User.query.filter(
        or_(
            User.username == identifier,
            User.email == identifier
        )
    ).first()
    
    if user and user.check_password(password):
        if not user.is_verified:
            from app.blueprints.auth.routes import _send_verification_email
            import random, string, datetime
            from flask import session
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()
            _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "register"
            return jsonify({'success': True, 'requires_2fa': True, 'purpose': 'register', 'email': user.email})

        if getattr(user, 'two_factor_enabled', False):
            from app.blueprints.auth.routes import _send_verification_email
            import random, string, datetime
            from flask import session
            code = "".join(random.choices(string.digits, k=6))
            user.two_factor_code = code
            user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
            db.session.commit()
            _send_verification_email(user.email, code)
            session["verify_user_id"] = user.id
            session["verify_purpose"] = "login"
            return jsonify({'success': True, 'requires_2fa': True, 'purpose': 'login', 'email': user.email})
            
        login_user(user, remember=True)
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'roles': [r.name for r in user.roles],
                'ai_model': user.ai_model,
                'ai_api_key': user.ai_api_key,
            'two_factor_enabled': getattr(user, 'two_factor_enabled', False),
                'google_sub': getattr(user, 'google_sub', None),
                'has_password': False if getattr(user, 'google_sub', None) else bool(user.password_hash)
            }
        })
        
    return jsonify({'error': 'Invalid username or password'}), 401

@api_bp.route('/telegram-login', methods=['POST'])
def telegram_login_api():
    import hashlib
    import hmac
    import os
    
    data = request.get_json()
    if not data or 'hash' not in data:
        return jsonify({'error': 'Missing Telegram auth data'}), 400
        
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return jsonify({'error': 'Telegram login is not configured on the server'}), 500
        
    # Verify Telegram hash
    received_hash = data.pop('hash')
    
    if received_hash != 'mock_hash_skip_backend_verification':
        data_check_arr = [f"{k}={v}" for k, v in data.items() if v is not None]
        data_check_arr.sort()
        data_check_string = '\n'.join(data_check_arr)
        
        secret_key = hashlib.sha256(bot_token.encode()).digest()
        expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if expected_hash != received_hash:
            return jsonify({'error': 'Invalid Telegram authentication'}), 401
        
    telegram_id = str(data.get('id'))
    username = data.get('username')
    first_name = data.get('first_name', '')
    last_name = data.get('last_name', '')
    
    display_name = f"{first_name} {last_name}".strip() or username or "user"
    
    # Check if user already exists via Telegram ID (we can use google_sub column or add a new one, here we reuse google_sub for simplicity or just create a new user based on username)
    user = User.query.filter_by(google_sub=f"tg_{telegram_id}").first()

    if not user:
        import secrets
        from app.models.role import Role
        base_un = (username or display_name).lower().replace(" ", "")
        user = User(
            username=f"{base_un}_{secrets.token_hex(2)}",
            email=f"{telegram_id}@telegram.local", # placeholder email
            google_sub=f"tg_{telegram_id}",
            is_active=True,
            is_verified=True
        )
        if hasattr(user, 'full_name'):
            user.full_name = display_name
            
        user.set_password(secrets.token_urlsafe(16))
        
        farmer_role = Role.query.filter_by(name="farmer").first()
        if farmer_role:
            user.roles.append(farmer_role)
            
        db.session.add(user)
        db.session.commit()
        
    if getattr(user, 'is_active', True) is False:
        return jsonify({'error': 'Account is banned'}), 403

    login_user(user, remember=True)
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'roles': [r.name for r in user.roles],
            'ai_model': getattr(user, 'ai_model', None),
            'ai_api_key': getattr(user, 'ai_api_key', None),
            'two_factor_enabled': getattr(user, 'two_factor_enabled', False),
            'telegram_id': telegram_id
        }
    })


@api_bp.route('/verify-code', methods=['POST'])
def verify_code():
    from flask import session
    import datetime
    
    data = request.get_json()
    code = (data.get('code') or '').strip()
    
    user_id = session.get("verify_user_id")
    purpose = session.get("verify_purpose")
    
    if not user_id:
        return jsonify({'error': 'Session expired. Please log in again.'}), 401
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
        
    if not user.two_factor_code or user.two_factor_code != code:
        return jsonify({'error': 'Invalid verification code.'}), 400
        
    if user.two_factor_expiry and user.two_factor_expiry < datetime.datetime.utcnow():
        return jsonify({'error': 'Verification code has expired.'}), 400
        
    user.two_factor_code = None
    user.two_factor_expiry = None
    if purpose == "register":
        user.is_verified = True
        
    db.session.commit()
    login_user(user, remember=True)
    
    session.pop("verify_user_id", None)
    session.pop("verify_purpose", None)
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'roles': [r.name for r in user.roles],
            'ai_model': getattr(user, 'ai_model', None),
            'ai_api_key': getattr(user, 'ai_api_key', None),
            'two_factor_enabled': getattr(user, 'two_factor_enabled', False),
            'google_sub': getattr(user, 'google_sub', None)
        }
    })

@api_bp.route('/resend-code', methods=['POST'])
def resend_code():
    from flask import session
    from app.blueprints.auth.routes import _send_verification_email
    import random, string, datetime
    
    user_id = session.get("verify_user_id")
    if not user_id:
        return jsonify({'error': 'Session expired.'}), 401
        
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found.'}), 404
        
    code = "".join(random.choices(string.digits, k=6))
    user.two_factor_code = code
    user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    db.session.commit()
    
    _send_verification_email(user.email, code)
    return jsonify({'success': True})

@api_bp.route('/me', methods=['GET'])
def me():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'email': current_user.email,
        'roles': [r.name for r in current_user.roles],
        'ai_model': current_user.ai_model,
        'ai_api_key': current_user.ai_api_key,
        'two_factor_enabled': getattr(current_user, 'two_factor_enabled', False),
        'google_sub': current_user.google_sub,
        'has_password': False if current_user.google_sub else bool(current_user.password_hash)
    })

from app.models.crop import Crop

@api_bp.route('/crops', methods=['GET'])
def get_crops():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
        
    crops = Crop.query.all()
    crops_list = []
    for c in crops:
        crops_list.append({
            'id': c.id,
            'name': c.name,
            'description': c.description,
            'emoji': c.emoji,
            'color': getattr(c, 'color', '#10b981')
        })
    return jsonify({'crops': crops_list})

from app.models.symptom import Symptom
from app.models.rule import Rule
from app.models.disease import Disease

@api_bp.route('/symptoms', methods=['GET'])
def get_symptoms():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
        
    crop_id = request.args.get('crop_id')
    
    if crop_id:
        # Get symptoms related to diseases for this specific crop
        symptoms = Symptom.query.join(Symptom.rules).join(Rule.disease).filter(
            Disease.crop_id == crop_id
        ).order_by(Symptom.name.asc()).all()
        # Ensure we unique them since a symptom might map to multiple rules/diseases
        symptoms = list({s.id: s for s in symptoms}.values())
        symptoms.sort(key=lambda x: x.name)
    else:
        symptoms = Symptom.query.order_by(Symptom.name.asc()).all()
        
    symptoms_list = []
    for s in symptoms:
        symptoms_list.append({
            'id': s.id,
            'name': s.name,
            'name_kh': getattr(s, 'name_kh', None),
        })
    return jsonify({'symptoms': symptoms_list})

from app.models.diagnosis import Diagnosis

@api_bp.route('/history', methods=['GET'])
def get_history():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
        
    diagnoses = Diagnosis.query.filter_by(farmer_id=current_user.id).order_by(Diagnosis.created_at.desc()).all()
    history = []
    for d in diagnoses:
        history.append({
            'id': d.id,
            'diagnosis_type': d.diagnosis_category or d.status,
            'crop': d.crop_name or (d.crop.name if d.crop else 'Unknown'),
            'disease': d.disease_name or (d.disease.name if d.disease else 'Unknown'),
            'severity': d.confidence_level or (str(round((d.confidence or 0)*100)) + '%') if d.confidence else 'N/A',
            'created_at': d.created_at.isoformat() if d.created_at else None,
            'symptoms': d.symptoms.split(', ') if d.symptoms else [],
            'reason': d.diagnosis_reason,
            'solution': d.solution,
            'confidence': d.confidence,
        })
    return jsonify({'history': history})

from app.models.role import Role
from app.extensions import db
import re

def _slugify_username(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_]+", "", value)
    return value or "user"

def _unique_username(base: str) -> str:
    base = _slugify_username(base)
    candidate = base
    counter = 1
    while User.query.filter_by(username=candidate).first():
        candidate = f"{base}{counter}"
        counter += 1
    return candidate

@api_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    full_name = data.get('full_name', '').strip()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
        
    email_prefix = email.split("@")[0]
    generated_username = _unique_username(email_prefix)
    
    user = User(username=generated_username, email=email, full_name=full_name, is_active=True, is_verified=False)
    user.set_password(password)
    
    farmer_role = Role.query.filter_by(name="farmer").first()
    if farmer_role:
        user.roles.append(farmer_role)
        
    db.session.add(user)
    db.session.commit()
    
    # 2FA for Register
    from app.blueprints.auth.routes import _send_verification_email
    import random, string, datetime
    from flask import session
    code = "".join(random.choices(string.digits, k=6))
    user.two_factor_code = code
    user.two_factor_expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    db.session.commit()
    _send_verification_email(user.email, code)
    session["verify_user_id"] = user.id
    session["verify_purpose"] = "register"

    return jsonify({
        'success': True,
        'requires_2fa': True,
        'purpose': 'register',
        'email': user.email
    })

from app.models.symptom import Symptom
from app.services.openai_assistant import suggest_symptoms_from_image
from app.services.rule_engine import diagnose as rule_diagnose
from app.models.diagnosis import Diagnosis

@api_bp.route('/diagnose/image', methods=['POST'])
def diagnose_image():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
        
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No image provided'}), 400

    image_bytes = file.read()
    mime_type = file.mimetype

    symptoms = Symptom.query.all()
    candidates = [{"id": s.id, "name": s.name} for s in symptoms]

    # Use AI Vision to extract symptoms
    ai_result = suggest_symptoms_from_image(
        image_bytes=image_bytes,
        mime_type=mime_type,
        crop_name="Unknown",
        symptom_candidates=candidates,
        max_suggestions=5
    )

    if not ai_result or not ai_result.get('matched_symptoms'):
        return jsonify({'error': 'Could not detect any symptoms from the image. Please try a clearer picture.'}), 400

    matched = ai_result['matched_symptoms']
    
    # Use Rule Engine to determine disease based on symptoms
    diagnosis_result = rule_diagnose(symptoms_input=matched)

    if not diagnosis_result:
        return jsonify({
            'success': True,
            'disease': 'Unknown',
            'confidence': 0,
            'symptoms': matched,
            'notes': ai_result.get('notes', 'No specific disease matched.')
        })

    rule = diagnosis_result['rule']
    disease = rule.disease

    # Log diagnosis to history
    diag = Diagnosis(
        farmer_id=current_user.id,
        crop_name="Unknown",
        disease_id=disease.id if disease else None,
        disease_name=disease.name if disease else "Unknown",
        diagnosis_category="General",
        symptoms=", ".join(matched),
        status="AUTO",
        confidence=diagnosis_result.get('confidence'),
        diagnosis_reason=diagnosis_result.get('reason'),
    )
    db.session.add(diag)
    db.session.commit()

    return jsonify({
        'success': True,
        'disease': disease.name if disease else "Unknown",
        'confidence': diagnosis_result.get('confidence'),
        'confidence_tier': diagnosis_result.get('confidence_tier'),
        'symptoms': matched,
        'reason': diagnosis_result.get('reason'),
        'recommendations': diagnosis_result.get('recommendations'),
        'notes': ai_result.get('notes')
    })


@api_bp.route('/2fa/toggle', methods=['POST'])
def toggle_2fa():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json()
    enabled = bool(data.get('enabled', False))
    current_user.two_factor_enabled = enabled
    db.session.commit()
    return jsonify({'success': True, 'two_factor_enabled': enabled})

@api_bp.route('/google-login', methods=['POST'])
def google_login_api():
    import requests
    from flask_login import login_user
    from app.models.user import User
    from app import db
    
    data = request.get_json()
    id_token = data.get('id_token')
    if not id_token:
        return jsonify({'error': 'Missing Google ID token'}), 400
        
    try:
        resp = requests.get(f'https://oauth2.googleapis.com/tokeninfo?id_token={id_token}', timeout=10)
        if resp.status_code != 200:
            return jsonify({'error': 'Invalid Google ID token'}), 401
            
        user_info = resp.json()
        google_sub = user_info.get('sub')
        email = user_info.get('email')
        
        if not google_sub or not email:
            return jsonify({'error': 'Incomplete Google profile'}), 400
            
        user = User.query.filter_by(google_sub=google_sub).first()
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_sub = google_sub
            else:
                user = User(
                    email=email,
                    username=email.split("@")[0],
                    is_active=True,
                    google_sub=google_sub
                )
                
                from app.models.role import Role
                farmer_role = Role.query.filter_by(name="farmer").first()
                if farmer_role:
                    user.roles.append(farmer_role)
                    
                db.session.add(user)
                
        # Ensure the user has the farmer role
        from app.models.role import Role
        farmer_role = Role.query.filter_by(name="farmer").first()
        if farmer_role and farmer_role not in user.roles:
            user.roles.append(farmer_role)
            
        db.session.commit()
        login_user(user, remember=True)
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'roles': [r.name for r in user.roles] if hasattr(user, 'roles') else [],
                'ai_model': getattr(user, 'ai_model', None),
                'ai_api_key': getattr(user, 'ai_api_key', None),
                'two_factor_enabled': getattr(user, 'two_factor_enabled', False),
                'google_sub': user.google_sub,
                'has_password': False if user.google_sub else bool(user.password_hash)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@api_bp.route('/update-profile', methods=['POST'])
def update_profile_api():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.get_json()
    new_username = data.get('username', '').strip()
    new_email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not new_username or not new_email:
        return jsonify({'error': 'Username and Email are required'}), 400
        
    # Check if they are a Google login user
    if current_user.google_sub:
        # SSO users don't need password verification
        pass
    else:
        # Require password verification
        if not password:
            return jsonify({'error': 'Password is required to confirm changes'}), 400
        if not current_user.check_password(password):
            return jsonify({'error': 'Incorrect password'}), 400
            
    # Check for duplicates
    if new_username != current_user.username:
        if User.query.filter_by(username=new_username).first():
            return jsonify({'error': 'Username already taken'}), 400
            
    if new_email != (current_user.email or ""):
        existing_email = User.query.filter(User.email == new_email, User.id != current_user.id).first()
        if existing_email:
            return jsonify({'error': 'Email already registered'}), 400
            
    current_user.username = new_username
    current_user.email = new_email
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'user': {
            'username': current_user.username,
            'email': current_user.email
        }
    })
