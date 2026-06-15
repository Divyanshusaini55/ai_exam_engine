# Production Deployment & Operations Guide

This guide details the steps and best practices for deploying the **ExamIntel** (Django API + Next.js Frontend + PostgreSQL + Redis + Celery) platform to a production environment.

---

## 1. System Architecture

A production setup comprises the following components:

```mermaid
graph TD
    Client[Browser / Client] -->|HTTPS| Proxy[Nginx / Cloudflare]
    Proxy -->|Port 3000| Frontend[Next.js SSR Frontend]
    Proxy -->|Port 8000| Backend[Django API Gunicorn]
    Frontend -->|API Requests| Backend
    Backend -->|Read/Write| DB[(PostgreSQL)]
    Backend -->|Caching & Sessions| Redis[(Redis Cache / Broker)]
    Backend -->|Enqueue Tasks| Redis
    CeleryWorker[Celery Task Worker] -->|Listen| Redis
    CeleryWorker -->|Process AI / PDFs| DB
    CeleryBeat[Celery Beat Scheduler] -->|Enqueue Cron Tasks| Redis
```

---

## 2. Environment Variables Configuration

Create and configure your `.env` files for production. Never commit these files to your Git repository.

### A. Backend (Django) Services
Set these on your Django app, Celery worker, and Celery beat environments:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DEBUG` | Disables debug screens & exposes production security headers | `False` |
| `SECRET_KEY` | High-entropy random key for signing cookies and tokens | `django-secure-xyz-123-your-long-random-string` |
| `ALLOWED_HOSTS` | Comma-separated list of backend domains | `api.examintele.com` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of frontend domains | `https://www.examintele.com,https://examintele.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname` |
| `REDIS_URL` | Redis URL for Celery Broker and Results | `redis://redis-host:6379/0` |
| `REDIS_CACHE_URL` | Redis URL for caching (recommended DB 1) | `redis://redis-host:6379/1` |
| `REDIS_SESSION_URL` | Redis URL for session storage (recommended DB 2) | `redis://redis-host:6379/2` |
| `GEMINI_API_KEY` | API key for generating AI summaries & roadmaps | `AIzaSyYourKeyHere...` |
| `CELERY_TASK_ALWAYS_EAGER` | Should Celery run tasks synchronously? | `False` |
| `ADMIN_USERNAME` | Username for automatically created administrator | `admin` |
| `ADMIN_PASSWORD` | Strong password for administrator | `SuperSecurePassword123!` |
| `ADMIN_EMAIL` | Email for administrator | `admin@examintele.com` |

### B. Frontend (Next.js) Web App
Set these on your Next.js builder and runner environments:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Optimizes Next.js builds | `production` |
| `NEXT_PUBLIC_API_BASE_URL` | Full URL to the Django API gateway | `https://api.examintele.com/api` |

---

## 3. Production Docker Files

We use multi-stage Docker builds to ensure that the final images are lightweight, fast, and contain zero build tools (like `npm` or `gcc`) for security.

### A. Next.js Frontend ([Dockerfile.prod](file:///Users/divyanshu/Desktop/ai_exam_engine/frontend/Dockerfile.prod))
This is located at `/frontend/Dockerfile.prod` and uses `npm ci` for lockfile compliance:
```dockerfile
# Stage 1: Build Next.js bundle
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

# Stage 2: Minimalist Runner image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### B. Django Backend ([Dockerfile](file:///Users/divyanshu/Desktop/ai_exam_engine/backend/Dockerfile))
The backend uses a standard Debian-based Python image. It expects the database to be ready, applies migrations, collects static assets via Whitenoise, and spins up Gunicorn.
- **Entrypoint**: Runs `python manage.py migrate`, `python manage.py collectstatic`, and `python manage.py create_admin`.
- **WSGI Server**: Launches `gunicorn core.wsgi:application --bind 0.0.0.0:${PORT}`.

---

## 4. Serving Static & Media Files in Production

1. **Static Files (CSS/JS/Assets)**:
   Django is configured to use **Whitenoise** (`whitenoise.storage.CompressedManifestStaticFilesStorage`).
   During deployment, the script executes `python manage.py collectstatic --no-input`. Whitenoise compresses and hashes these files, and Django serves them directly with aggressive caching headers.
   
2. **Media Files (PDFs / Uploads)**:
   Containers are ephemeral; files written to `/app/media` will be lost when a container restarts.
   **Crucial for Production:** Install `django-storages` and configure an object storage provider (e.g., Google Cloud Storage or AWS S3) in `settings.py`:
   ```python
   # Add to backend/core/settings.py in production:
   DEFAULT_FILE_STORAGE = 'storages.backends.gcloud.GoogleCloudStorage'
   GS_BUCKET_NAME = 'your-production-media-bucket'
   ```

---

## 5. Background Tasks (Celery & Redis)

Many heavy operations (generating roadmaps, parsing syllabus PDFs, emailing, leaderboard calculation) run asynchronously.

In production, you must deploy:
1. **Redis**: Used as the caching tier and message broker.
2. **Celery Worker**: Starts a worker process listening to the queues:
   ```bash
   celery -A core worker --loglevel=info -Q high,normal,low
   ```
3. **Celery Beat**: Starts the scheduler for recurring/cron jobs:
   ```bash
   celery -A core beat --loglevel=info
   ```
4. **Flower (Optional)**: Dashboard to monitor task execution:
   ```bash
   celery -A core flower --port=5555
   ```

---

## 6. Hosting Platforms & Deployment Steps

### Option A: Render or Railway (Recommended for Ease of Use)

This setup is ideal for quick deployments with fully managed resources.

1. **Deploy Redis & PostgreSQL**:
   - Provision a PostgreSQL database and a Redis instance from the dashboard.
   - Copy their connection strings.

2. **Deploy Django API (Web Service)**:
   - **Build Command**: `./build.sh` (installs dependencies, runs migrations, creates admin user, and bundles assets).
   - **Start Command**: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`
   - **Environment Variables**: Add your DB, Redis, and Gemini env vars.

3. **Deploy Celery Worker (Background Worker)**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `celery -A core worker --loglevel=info -Q high,normal,low`
   - **Environment Variables**: Inherit the same variables as the Django API.

4. **Deploy Next.js Frontend (Web Service)**:
   - **Dockerfile Path**: Set to `frontend/Dockerfile.prod`.
   - **Environment Variables**: Set `NEXT_PUBLIC_API_BASE_URL` to your newly deployed Django backend URL (`https://your-backend.render.com/api`).

---

### Option B: Google Cloud Run (Serverless)

Refer to the step-by-step setup in the workspace root:
👉 [DEPLOYMENT_GUIDE.md](file:///Users/divyanshu/Desktop/ai_exam_engine/DEPLOYMENT_GUIDE.md)

---

### Option C: Self-Hosted Virtual Machine (VPS / AWS EC2)

For hosting everything on a single virtual machine using Docker Compose and Nginx as a reverse proxy.

1. Create a `docker-compose.prod.yml` file:
   ```yaml
   version: '3.8'

   services:
     db:
       image: postgres:15-alpine
       volumes:
         - pgdata:/var/lib/postgresql/data
       environment:
         POSTGRES_DB: exam_engine
         POSTGRES_USER: exam_user
         POSTGRES_PASSWORD: StrongPasswordHere
       restart: always

     redis:
       image: redis:7-alpine
       restart: always

     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile
       environment:
         - DEBUG=False
         - DATABASE_URL=postgresql://exam_user:StrongPasswordHere@db:5432/exam_engine
         - REDIS_URL=redis://redis:6379/0
         - SECRET_KEY=prod-secret-key-change-this
         - ALLOWED_HOSTS=api.yourdomain.com
         - CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
         - GEMINI_API_KEY=your-api-key
       depends_on:
         - db
         - redis
       restart: always

     celery_worker:
       build:
         context: ./backend
         dockerfile: Dockerfile
       command: celery -A core worker --loglevel=info -Q high,normal,low
       environment:
         - DATABASE_URL=postgresql://exam_user:StrongPasswordHere@db:5432/exam_engine
         - REDIS_URL=redis://redis:6379/0
         - GEMINI_API_KEY=your-api-key
       depends_on:
         - redis
       restart: always

     celery_beat:
       build:
         context: ./backend
         dockerfile: Dockerfile
       command: celery -A core beat --loglevel=info
       environment:
         - DATABASE_URL=postgresql://exam_user:StrongPasswordHere@db:5432/exam_engine
         - REDIS_URL=redis://redis:6379/0
       depends_on:
         - redis
       restart: always

     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile.prod
         args:
           - NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api
       ports:
         - "3000:3000"
       restart: always

   volumes:
     pgdata:
   ```

2. Start the services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

3. Setup Nginx to forward requests to the frontend (port 3000) and backend (port 8000), and configure Let's Encrypt SSL.

---

## 7. Post-Deployment Checklist

- [ ] Verify database migrations completed successfully.
- [ ] Check Celery task logs to confirm AI roadmap generations are executing and scheduling correctly.
- [ ] Verify that static files load (e.g. CSS files return `200` with compression).
- [ ] Confirm Django admin access: go to `https://your-backend-domain/admin/` and log in with your administrative account credentials.
- [ ] Inspect the browser console to ensure there are no CORS blocks between the frontend and backend.
- [ ] Setup log rotating or configure logs streams (Google Cloud Logging, Datadog, or Render log metrics).
