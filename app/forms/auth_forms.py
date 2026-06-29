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
    username = StringField(
        "Gmail / Email",
        validators=[
            DataRequired(message="Email is required"),
            Length(min=3, max=80)
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
        "Gmail / Email",
        validators=[
            DataRequired(message="Email is required"),
            Email(message="Enter a valid email address"),
            Length(max=120)
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

    submit = SubmitField("Register")
