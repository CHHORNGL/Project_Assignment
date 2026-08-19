import re

file_path = "app/blueprints/api/routes.py"
with open(file_path, "r") as f:
    content = f.read()

# Add two_factor_enabled to user dicts
content = re.sub(
    r"'ai_api_key': getattr\(user, 'ai_api_key', None\),",
    r"'ai_api_key': getattr(user, 'ai_api_key', None),\n            'two_factor_enabled': getattr(user, 'two_factor_enabled', False),",
    content
)

content = re.sub(
    r"'ai_api_key': user\.ai_api_key,",
    r"'ai_api_key': user.ai_api_key,\n            'two_factor_enabled': getattr(user, 'two_factor_enabled', False),",
    content
)

content = re.sub(
    r"'ai_api_key': current_user\.ai_api_key,",
    r"'ai_api_key': current_user.ai_api_key,\n        'two_factor_enabled': getattr(current_user, 'two_factor_enabled', False),",
    content
)

# Add toggle endpoint
if "toggle_2fa" not in content:
    content += """

@api_bp.route('/2fa/toggle', methods=['POST'])
def toggle_2fa():
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json()
    enabled = bool(data.get('enabled', False))
    current_user.two_factor_enabled = enabled
    db.session.commit()
    return jsonify({'success': True, 'two_factor_enabled': enabled})
"""

with open(file_path, "w") as f:
    f.write(content)

print("Patch applied")
