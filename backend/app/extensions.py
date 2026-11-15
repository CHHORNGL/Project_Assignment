from authlib.integrations.flask_client import OAuth
from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_sqlalchemy.model import Model


class BaseModel(Model):
    """Base model class with explicit keyword argument initializer for IDE/static analysis support."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


db = SQLAlchemy(model_class=BaseModel)
login_manager = LoginManager()
migrate = Migrate()
oauth = OAuth()
