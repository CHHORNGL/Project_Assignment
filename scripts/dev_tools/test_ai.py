from app import create_app
from app.services.openai_assistant import generate_assistant_reply
from flask_login import login_user
from app.models.user import User
import traceback

app = create_app()
with app.app_context():
    class MockUser:
        is_authenticated = True
        ai_model = "gemini-1.5-flash"
        ai_api_key = None
        role = "admin"
        
    import app.services.openai_assistant as asst
    asst.current_user = MockUser()
    
    try:
        reply = asst.generate_assistant_reply("Hello, how are you?")
        print("REPLY:", reply)
    except Exception as e:
        traceback.print_exc()
        
    # Also test the fallback manually
    print("Testing Fallback directly:")
    client = asst._get_openai_client()
    import os
    model = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile").strip()
    print(f"Client: {client}, Model: {model}")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hello"}],
            temperature=0.3,
            max_tokens=50
        )
        print("SUCCESS:", response.choices[0].message.content)
    except Exception as e:
        traceback.print_exc()

