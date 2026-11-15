import re

with open('app/services/project_assistant.py', 'r') as f:
    content = f.read()

# Replace all os.getenv("OPENAI_MODEL"...) with _get_openai_model()
content = re.sub(
    r'os\.getenv\("OPENAI_MODEL", DEFAULT_MODEL\)\.strip\(\) or DEFAULT_MODEL',
    r'_get_openai_model()',
    content
)

# Insert the helper function definition after DEFAULT_MODEL definition
helper_func = """

def _get_openai_model():
    from app.models.site_setting import SiteSetting
    try:
        db_model = SiteSetting.query.get("OPENAI_MODEL")
        if db_model and db_model.value.strip():
            return db_model.value.strip()
    except Exception:
        pass
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

"""
content = content.replace('DEFAULT_MODEL = "llama-3.3-70b-versatile"\n', 'DEFAULT_MODEL = "llama-3.3-70b-versatile"\n' + helper_func)

with open('app/services/project_assistant.py', 'w') as f:
    f.write(content)
