import os

from django.core.wsgi import get_wsgi_application

os.environ["PYDANTIC_DISABLE_PLUGINS"] = "1"
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

application = get_wsgi_application()
