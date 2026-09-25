import unittest
from unittest.mock import patch, MagicMock
from app.blueprints.auth.routes import _send_verification_email

class TestEmailVerification(unittest.TestCase):
    @patch("smtplib.SMTP")
    @patch.dict("os.environ", {
        "MAIL_SERVER": "smtp-relay.brevo.com",
        "MAIL_PORT": "587",
        "MAIL_USERNAME": "test_user@example.com",
        "MAIL_PASSWORD": "test_password",
        "MAIL_DEFAULT_SENDER": "noreply@agrisystem.com"
    })
    def test_send_verification_email_success(self, mock_smtp):
        mock_instance = MagicMock()
        mock_smtp.return_value = mock_instance

        result = _send_verification_email("recipient@gmail.com", "654321")
        self.assertTrue(result)
        mock_smtp.assert_called_once_with("smtp-relay.brevo.com", 587, timeout=12)
        mock_instance.starttls.assert_called_once()
        mock_instance.login.assert_called_once_with("test_user@example.com", "test_password")
        mock_instance.sendmail.assert_called_once()
        mock_instance.quit.assert_called_once()

    @patch("smtplib.SMTP_SSL")
    @patch.dict("os.environ", {
        "MAIL_SERVER": "smtp.gmail.com",
        "MAIL_PORT": "465",
        "MAIL_USERNAME": "test_user@gmail.com",
        "MAIL_PASSWORD": "app_password_16char",
        "MAIL_DEFAULT_SENDER": "test_user@gmail.com"
    })
    def test_send_verification_email_ssl(self, mock_smtp_ssl):
        mock_instance = MagicMock()
        mock_smtp_ssl.return_value = mock_instance

        result = _send_verification_email("recipient@gmail.com", "112233")
        self.assertTrue(result)
        mock_smtp_ssl.assert_called_once_with("smtp.gmail.com", 465, timeout=12)
        mock_instance.login.assert_called_once_with("test_user@gmail.com", "app_password_16char")
        mock_instance.sendmail.assert_called_once()

    @patch("smtplib.SMTP")
    @patch.dict("os.environ", {
        "MAIL_SERVER": "smtp-relay.brevo.com",
        "MAIL_PORT": "587",
        "MAIL_USERNAME": "test_user@example.com",
        "MAIL_PASSWORD": "test_password",
        "MAIL_DEFAULT_SENDER": "noreply@agrisystem.com"
    })
    def test_send_verification_email_smtp_failure(self, mock_smtp):
        mock_instance = MagicMock()
        mock_smtp.return_value = mock_instance
        mock_instance.login.side_effect = Exception("(525, b'5.7.1 Unauthorized IP address')")

        result = _send_verification_email("recipient@gmail.com", "999888")
        self.assertFalse(result)

    @patch("urllib.request.urlopen")
    @patch.dict("os.environ", {
        "BREVO_API_KEY": "xkeysib-test-api-key",
        "MAIL_DEFAULT_SENDER": "hellofromadmin@agricultureexp.space"
    })
    def test_send_verification_email_brevo_api(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.status = 201
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        result = _send_verification_email("recipient@gmail.com", "778899")
        self.assertTrue(result)
        mock_urlopen.assert_called_once()

    @patch.dict("os.environ", {
        "BREVO_API_KEY": "",
        "MAIL_SERVER": "",
        "MAIL_PORT": "",
        "MAIL_USERNAME": "your_gmail_address_here@gmail.com",
        "MAIL_PASSWORD": ""
    })
    def test_send_verification_email_unconfigured(self):
        result = _send_verification_email("recipient@gmail.com", "123456")
        self.assertFalse(result)

if __name__ == "__main__":
    unittest.main()

