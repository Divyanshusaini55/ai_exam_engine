#!/bin/sh

if [ "$DATABASE" = "postgres" ]
then
    echo "Waiting for postgres..."
    while ! nc -z $SQL_HOST $SQL_PORT; do
      sleep 0.1
    done
    echo "PostgreSQL started"
fi

if [ "$1" != "celery" ]; then
    echo "Applying database migrations..."
    python manage.py migrate --noinput

    echo "Collecting static files..."
    python manage.py collectstatic --noinput

    if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
        echo "Creating superuser (if not exists)..."
        python manage.py createsuperuser --noinput || true
    else
        echo "Skipping superuser creation: DJANGO_SUPERUSER_USERNAME and DJANGO_SUPERUSER_PASSWORD are not set in environment."
    fi
fi

echo "Starting server..."
if [ $# -gt 0 ]; then
    exec "$@"
else
    exec gunicorn core.wsgi:application --bind 0.0.0.0:${PORT:-8000}
fi
