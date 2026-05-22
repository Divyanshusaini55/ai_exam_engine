
import os

from django.core.asgi import get_asgi_application

os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

application = get_asgi_application()
