#!/usr/bin/env python3
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.blueprints.auth.routes import _send_verification_email

def main():
    recipient = sys.argv[1] if len(sys.argv) > 1 else (os.environ.get("ADMIN_EMAIL") or "iks214262@gmail.com")
    print(f"Testing SMTP email sending via {os.environ.get('MAIL_SERVER')}:{os.environ.get('MAIL_PORT')}")
    print(f"From: {os.environ.get('MAIL_DEFAULT_SENDER')}")
    print(f"To:   {recipient}")
    print("-" * 50)
    
    success = _send_verification_email(recipient, "987654")
    
    if success:
        print("\n🎉 SUCCESS! Verification email was successfully transmitted via Brevo SMTP.")
        print(f"Please check your inbox (and spam folder) for {recipient}.")
    else:
        print("\n❌ FAILED: Brevo SMTP could not deliver the email.")
        print("Please check your Brevo Security settings for Authorized IPs.")

if __name__ == "__main__":
    main()
