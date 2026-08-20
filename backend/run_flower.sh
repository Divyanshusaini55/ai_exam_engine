#!/usr/bin/env bash

PORT=${FLOWER_PORT:-5555}
BROKER_URL=${CELERY_BROKER_URL:-redis://localhost:6379/0}

echo "Starting Celery Flower Monitoring on http://localhost:$PORT ..."
echo "Broker: $BROKER_URL"

exec celery -A core flower --port="$PORT" --broker="$BROKER_URL"
