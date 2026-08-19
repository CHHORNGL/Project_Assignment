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
            
        login_user(user)
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
                'google_sub': getattr(user, 'google_sub', None)
            }
        })
        
    return jsonify({'error': 'Invalid username or password'}), 401

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
    login_user(user)
    
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
        'google_sub': current_user.google_sub
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
