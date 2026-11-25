from .config import Settings
from .main import create_app

settings = Settings()
settings.require_postgresql()
app = create_app(settings)
