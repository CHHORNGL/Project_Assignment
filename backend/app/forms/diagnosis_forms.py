from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField
from wtforms.validators import DataRequired, Length


class DiagnosisForm(FlaskForm):
    crop_name = StringField(
        "Crop Name",
        validators=[
            DataRequired(message="Crop name is required"),
            Length(max=100, message="Crop name must be less than 100 characters")
        ]
    )

    disease_name = StringField(
        "Disease / Symptoms",
        validators=[
            DataRequired(message="Disease or symptoms are required"),
            Length(max=100, message="Disease name must be less than 100 characters")
        ]
    )

    submit = SubmitField("Submit Diagnosis")
