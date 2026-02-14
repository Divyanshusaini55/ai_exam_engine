
from pathlib import Path
import os
from dotenv import load_dotenv # Make sure to install this package
import dj_database_url

# Load environment variables from a .env file located in the base directory
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'rest_framework.authtoken',  
    'corsheaders',
    # Local apps
    'core',  # Required for management commands
    'quiz',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # For serving static files in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # CORS middleware must be high up
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'


# Database
# Use PostgreSQL in production via DATABASE_URL, SQLite for local development
if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # Default SQLite for local development
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (For PDF Uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Redis Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings - configured via environment variable
# For local development, defaults to localhost:3000
# For production, set CORS_ALLOWED_ORIGINS env var to your frontend URLs (comma-separated)
# CORS settings
cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins.split(',')]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings - Django 4.0+ requires trusted origins for cross-origin POST requests
CSRF_TRUSTED_ORIGINS = [
    'https://ai-exam-engine.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
] + CORS_ALLOWED_ORIGINS

# Only allow all origins in development
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Only True when DEBUG=True

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20
}


# Get key from .env file. Do NOT provide a fallback value here.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    # This ensures the server won't start if the key is missing,
    # preventing silent failures later.
    raise ValueError(
        "GEMINI_API_KEY is missing from environment variables! "
        "Please create a .env file in the backend/ folder and add your key."
    )

DATA_UPLOAD_MAX_NUMBER_FIELDS = 20000


# Email Backend for Development (Prints to Console)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = 'localhost'
EMAIL_PORT = 1025
EMAIL_HOST_USER = ''
EMAIL_HOST_PASSWORD = ''
EMAIL_USE_TLS = False
DEFAULT_FROM_EMAIL = 'noreply@examplatform.com'

# Production Security Settings (Only active when DEBUG=False)
if not DEBUG:
    # Tell Django that we are behind a proxy that handles SSL (Render/Heroku/etc)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    SECURE_SSL_REDIRECT = True
    
    # Cookie Security for Cross-Site (Vercel <-> Render)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    # CRITICAL: Allow cookies to be sent in cross-site requests
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'
    
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
