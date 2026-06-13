
from pathlib import Path
import os
from dotenv import load_dotenv
import dj_database_url
from kombu import Queue

if not os.environ.get('RUNNING_IN_DOCKER'):
    load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-this-in-production')


DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')


# Application definition

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',  
    'corsheaders',
    'core',
    'quiz',
    'community',
    'health',
    'jobs',
    'django_celery_beat',
    'drf_spectacular',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
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

if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
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
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Logging Configuration for Cloud Run
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} [{levelname}] {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': True,
        },
        'tasks': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'cache': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'events': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'jobs': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'health': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

def _redis_db_url(base_url, db_number):
    if base_url.rstrip('/').split('/')[-1].isdigit():
        base_url = '/'.join(base_url.rstrip('/').split('/')[:-1])
    return f'{base_url.rstrip("/")}/{db_number}'

REDIS_CACHE_URL = os.environ.get('REDIS_CACHE_URL', _redis_db_url(REDIS_URL, 1))
REDIS_SESSION_URL = os.environ.get('REDIS_SESSION_URL', _redis_db_url(REDIS_URL, 2))

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'RETRY_ON_TIMEOUT': True,
            'MAX_CONNECTIONS': 50,
            'CONNECTION_POOL_KWARGS': {
                'max_connections': 50,
                'retry_on_timeout': True,
            },
        },
        'KEY_PREFIX': 'exam_engine',
        'TIMEOUT': 300,
    }
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Token', 'Bearer'),
}

SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)

# Serialization
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Reliability
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # Fair scheduling
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_MAX_RETRIES = 3

# Result expiry
CELERY_RESULT_EXPIRES = 3600  # 1 hour

# Queues and Routing
CELERY_QUEUES = (
    Queue('high', routing_key='high'),
    Queue('normal', routing_key='normal'),
    Queue('low', routing_key='low'),
    Queue('maintenance', routing_key='maintenance'),
)

CELERY_TASK_ROUTES = {
    'tasks.summary_tasks.*': {'queue': 'normal'},
    'tasks.roadmap_tasks.*': {'queue': 'normal'},
    'tasks.pdf_tasks.*': {'queue': 'high'},
    'tasks.analytics_tasks.cleanup_stale_jobs': {'queue': 'maintenance'},
    'tasks.analytics_tasks.*': {'queue': 'low'},
    'tasks.notification_tasks.*': {'queue': 'high'},
}

CELERY_TASK_ANNOTATIONS = {
    'tasks.summary_tasks.generate_exam_summary': {'time_limit': 600, 'soft_time_limit': 540},
    'tasks.summary_tasks.generate_topic_explanation': {'time_limit': 300, 'soft_time_limit': 270},
    'tasks.roadmap_tasks.generate_exam_roadmap': {'time_limit': 900, 'soft_time_limit': 840},
    'tasks.roadmap_tasks.refresh_roadmap_resources': {'time_limit': 600, 'soft_time_limit': 540},
    'tasks.pdf_tasks.parse_question_paper': {'time_limit': 600, 'soft_time_limit': 540},
    'tasks.pdf_tasks.parse_syllabus_pdf': {'time_limit': 600, 'soft_time_limit': 540},
    'tasks.analytics_tasks.recalculate_community_ranks': {'time_limit': 300, 'soft_time_limit': 270},
    'tasks.analytics_tasks.refresh_leaderboard_cache': {'time_limit': 120, 'soft_time_limit': 100},
    'tasks.analytics_tasks.cleanup_stale_jobs': {'time_limit': 120, 'soft_time_limit': 100},
    'tasks.notification_tasks.send_email_notification': {'time_limit': 60, 'soft_time_limit': 45},
    'tasks.notification_tasks.send_bulk_notification': {'time_limit': 300, 'soft_time_limit': 270},
}


CELERY_TASK_ALWAYS_EAGER = os.environ.get('CELERY_TASK_ALWAYS_EAGER', 'False') == 'True'
CELERY_TASK_EAGER_PROPAGATES = True

CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000
CELERY_WORKER_HIJACK_ROOT_LOGGER = False

CELERY_FLOWER_PORT = int(os.environ.get('FLOWER_PORT', 5555))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins.split(',')]
CORS_ALLOW_CREDENTIALS = True

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

CSRF_TRUSTED_ORIGINS = [
    'https://ai-exam-engine.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://*.run.app', 
] + CORS_ALLOWED_ORIGINS

CORS_ALLOW_ALL_ORIGINS = DEBUG

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/minute',
        'user': '300/minute',
        'ai_heavy': '100/hour',
        'ai_light': '1000/hour',
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Exam Intel API',
    'DESCRIPTION': 'API documentation for the Exam Intel backend',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is missing from environment variables! "
        "Please create a .env file in the backend/ folder and add your key."
    )

GEMINI_SUMMARY_MODEL = os.environ.get('GEMINI_SUMMARY_MODEL', 'models/gemini-2.5-flash')

DATA_UPLOAD_MAX_NUMBER_FIELDS = 20000

JAZZMIN_SETTINGS = {
    'site_title': 'Exam Intel',
    'site_header': 'Exam Intel',
    'site_brand': 'Exam Intel',
    'site_logo': 'admin/img/logo.png',
    'site_logo_classes': 'img-circle elevation-3',
    'site_icon': 'admin/img/logo.png',
    'welcome_sign': 'Welcome to Exam Intel Control Center',
    'copyright': 'Exam Intel — Internal Dashboard',
    
    'search_model': ['quiz.Exam', 'quiz.Question', 'auth.User'],

    'user_avatar': None,

    'topmenu_links': [
        {'name': 'Platform', 'url': 'http://localhost:3000', 'new_window': True, 'icon': 'fas fa-external-link-alt'},
        {'name': 'API Docs', 'url': '/api/', 'new_window': True, 'icon': 'fas fa-code'},
        {'model': 'auth.User'},
    ],

    'usermenu_links': [
        {'name': 'Platform', 'url': 'http://localhost:3000', 'new_window': True, 'icon': 'fas fa-external-link-alt'},
    ],
    'show_sidebar': True,
    'navigation_expanded': True,
    'hide_apps': [],
    'hide_models': [],

    'order_with_respect_to': [
        'quiz', 'quiz.Category', 'quiz.SubCategory',
        'quiz.Exam', 'quiz.Question', 'quiz.Answer',
        'quiz.QuestionPaperUpload', 'quiz.CorrectionSuggestion',
        'quiz.CurrentAffair',
        'quiz.ExamRoadmap', 'quiz.RoadmapPhase', 'quiz.RoadmapTopic',
        'quiz.UserTopicProgress',
        'quiz.UserAnswer', 'quiz.ContactMessage',
        'auth', 'community',
    ],

    'icons': {
        'auth': 'fas fa-users-cog',
        'auth.user': 'fas fa-user',
        'auth.Group': 'fas fa-users',
        'quiz.Category': 'fas fa-th-large',
        'quiz.SubCategory': 'fas fa-layer-group',
        'quiz.Exam': 'fas fa-file-alt',
        'quiz.Question': 'fas fa-question-circle',
        'quiz.Answer': 'fas fa-check-circle',
        'quiz.QuestionPaperUpload': 'fas fa-cloud-upload-alt',
        'quiz.CorrectionSuggestion': 'fas fa-edit',
        'quiz.CurrentAffair': 'fas fa-newspaper',
        'quiz.ExamRoadmap': 'fas fa-map',
        'quiz.RoadmapPhase': 'fas fa-stream',
        'quiz.RoadmapTopic': 'fas fa-bookmark',
        'quiz.UserTopicProgress': 'fas fa-chart-line',
        'quiz.UserAnswer': 'fas fa-poll',
        'quiz.ContactMessage': 'fas fa-envelope',
        'community': 'fas fa-comments',
    },

    'default_icon_parents': 'fas fa-chevron-circle-right',
    'default_icon_children': 'fas fa-circle',

    'related_modal_active': True,
    'custom_css': 'admin/css/custom_admin.css',
    'custom_js': None,
    'use_google_fonts_cdn': True,
    'show_ui_builder': False,

    'changeform_format': 'horizontal_tabs',
    'changeform_format_overrides': {
        'auth.user': 'collapsible',
        'auth.group': 'vertical_tabs',
    },
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text': False,
    'footer_small_text': False,
    'body_small_text': False,
    'brand_small_text': False,
    'brand_colour': False,
    'accent': 'accent-primary',
    'navbar': 'navbar-white navbar-light',
    'no_navbar_border': False,
    'navbar_fixed': True,
    'layout_boxed': False,
    'footer_fixed': False,
    'sidebar_fixed': True,
    'sidebar': 'sidebar-light-primary',  # already light
    'sidebar_nav_small_text': False,
    'sidebar_disable_expand': False,
    'sidebar_nav_child_indent': True,
    'sidebar_nav_compact_style': True,
    'sidebar_nav_legacy_style': False,
    'sidebar_nav_flat_style': False,
    'theme': 'default',
    'default_theme_mode': 'light',
    'button_classes': {
        'primary': 'btn-primary',
        'secondary': 'btn-outline-secondary',
        'info': 'btn-outline-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
}

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
EMAIL_HOST = 'localhost'
EMAIL_PORT = 1025
EMAIL_HOST_USER = ''
EMAIL_HOST_PASSWORD = ''
EMAIL_USE_TLS = False
DEFAULT_FROM_EMAIL = 'noreply@examplatform.com'

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    
    SECURE_SSL_REDIRECT = True
    
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    SESSION_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SAMESITE = 'None'
    
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
