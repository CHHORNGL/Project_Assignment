from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import (
    DataRequired,
    Length,
    EqualTo,
    Optional,
    Email
)


# ===============================
# LOGIN FORM
# ===============================
class LoginForm(FlaskForm):
    email = StringField(
        "Email Address",
        validators=[
            DataRequired(message="Email is required"),
            Email(message="Please enter a valid email address"),
            Length(min=3, max=120)
        ]
    )

    password = PasswordField(
        "Password",
        validators=[
            DataRequired(message="Password is required"),
            Length(min=3)
        ]
    )

    submit = SubmitField("Login")


# ===============================
# REGISTER FORM (FARMER)
# ===============================
class RegisterForm(FlaskForm):
    email = StringField(
        "Email Address",
        validators=[
            DataRequired(message="Email is required"),
            Email(message="Enter a valid email address"),
            Length(max=120)
        ]
    )
    
    verification_code = StringField(
        "Verification Code",
        validators=[
            DataRequired(message="Verification code is required"),
            Length(min=6, max=6, message="Code must be 6 digits")
        ]
    )

    full_name = StringField(
        "Full Name",
        validators=[
            Optional(),
            Length(max=120)
        ]
    )

    password = PasswordField(
        "Password",
        validators=[
            DataRequired(message="Password is required"),
            Length(min=6, message="Password must be at least 6 characters")
        ]
    )

    confirm_password = PasswordField(
        "Confirm Password",
        validators=[
            DataRequired(message="Please confirm your password"),
            EqualTo("password", message="Passwords do not match")
        ]
    )

    submit = SubmitField("Create Account")

# ===============================
# FORGOT PASSWORD FORMS
# ===============================
class ForgotPasswordForm(FlaskForm):
    email = StringField(
        "Email Address",
        validators=[
            DataRequired(message="Email is required"),
            Email(message="Enter a valid email address"),
            Length(max=120)
        ]
    )
    submit = SubmitField("Continue")

class ResetPasswordForm(FlaskForm):
    code = StringField(
        "Verification Code",
        validators=[
            DataRequired(message="Verification code is required"),
            Length(min=6, max=6, message="Code must be 6 digits")
        ]
    )
    password = PasswordField(
        "New Password",
        validators=[
            DataRequired(message="Password is required"),
            Length(min=6, message="Password must be at least 6 characters")
        ]
    )
    confirm_password = PasswordField(
        "Confirm New Password",
        validators=[
            DataRequired(message="Please confirm your password"),
            EqualTo("password", message="Passwords do not match")
        ]
    )
    submit = SubmitField("Reset Password")
