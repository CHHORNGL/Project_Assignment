import sys
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User

def send_mail(to_email, subject, html_body):
    smtp_server = os.environ.get("MAIL_SERVER")
    smtp_port = os.environ.get("MAIL_PORT")
    smtp_user = os.environ.get("MAIL_USERNAME")
    smtp_password = os.environ.get("MAIL_PASSWORD")
    smtp_sender = os.environ.get("MAIL_DEFAULT_SENDER", smtp_user)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_sender
    msg["To"] = to_email
    
    part = MIMEText(html_body, "html")
    msg.attach(part)
    
    if smtp_server and smtp_port and smtp_user and smtp_password:
        try:
            server = smtplib.SMTP(smtp_server, int(smtp_port), timeout=10)
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_sender, [to_email], msg.as_string())
            server.quit()
            print(f"Sent email to {to_email}")
        except Exception as e:
            print(f"SMTP failed to send email: {e}")
    else:
        print(f"Mock email sent to {to_email} (SMTP not fully configured)")

def run_check():
    app = create_app()
    with app.app_context():
        # Find users whose premium expires in exactly 2 or 3 days
        now = datetime.utcnow()
        upcoming_expirations = User.query.filter(
            User.is_premium == True,
            User.premium_expires_at != None
        ).all()
        
        sent_count = 0
        for user in upcoming_expirations:
            days_left = (user.premium_expires_at - now).days
            # Send reminder if exactly 2 or 3 days left
            if days_left in [2, 3]:
                subject = "Your Agri System Premium is expiring soon!"
                html_body = f"""
                <h3>Hello {user.full_name or user.username},</h3>
                <p>We hope you are enjoying your Premium benefits!</p>
                <p>This is an automated reminder that your Premium subscription will expire in <strong>{days_left} days</strong> on {user.premium_expires_at.strftime('%d %B %Y')}.</p>
                <p>To ensure uninterrupted access to unlimited AI diagnoses and expert chat, please log in and renew your subscription.</p>
                <br>
                <p>Best,<br>Agri System Team</p>
                """
                send_mail(user.email, subject, html_body)
                sent_count += 1
                print(f"Prepared reminder for {user.email} (expires in {days_left} days)")
                
        print(f"Subscription check complete. Handled {sent_count} reminders.")

if __name__ == "__main__":
    run_check()
