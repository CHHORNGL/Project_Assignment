with open("app/blueprints/admin/routes.py", "r") as f:
    text = f.read()

text = text.replace('            update_setting("API_KEY_GEMINI", ",".join(gemini_keys))\n            update_setting("API_KEY_GEMINI", gemini_key)\n', '            update_setting("API_KEY_GEMINI", ",".join(gemini_keys))\n')

with open("app/blueprints/admin/routes.py", "w") as f:
    f.write(text)
