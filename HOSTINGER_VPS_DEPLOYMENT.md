# Hostinger VPS Production Deployment Guide

This guide details how to deploy the entire **ExamIntel** stack (Next.js Frontend, Django API, Celery Workers, Flower monitoring) on a **Hostinger VPS** running **Ubuntu Server (22.04 or 24.04)**, using **Neon PostgreSQL** and **Upstash Redis** as external database/redis cloud providers.

---

## Prerequisites

1. **Hostinger VPS Server**: Access to a clean Ubuntu Server instance.
2. **Domain Names**: Set up DNS A-records in your domain registrar pointing to your VPS IP:
   - `examintel.in` & `www.examintel.in` (Next.js Frontend)
   - `api.examintel.in` (Django Backend API, Admin, and Flower)
3. **SSH Access**: Ability to SSH into your VPS (`ssh root@your_vps_ip`).

---

## Step 1: Update VPS & Install Docker & Git

SSH into your Hostinger VPS and run the following commands to install required system packages:

```bash
# Update local packages
sudo apt update && sudo apt upgrade -y

# Install git, nginx, and certbot (for SSL)
sudo apt install -y git nginx certbot python3-certbot-nginx curl

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify Docker and Docker Compose installation
docker --version
docker compose version
```

---

## Step 2: Clone the Project Repository

Clone your codebase onto the VPS. We will place it in `/var/www/ai_exam_engine`:

```bash
# Create target folder
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

# Clone repository
cd /var/www
git clone <YOUR_GIT_REPO_URL> ai_exam_engine
cd ai_exam_engine
```

---

## Step 3: Configure Production `.env` File

Create your production environment file for the backend:

```bash
nano backend/.env
```

Add your production environment variables (matching your custom database and Upstash credentials):

```env
# Production flags
DEBUG=False
SECRET_KEY='xq$c4krc@vwl9dsfxtz9y0amqp2w2%2u788+-%ms1*=6u80ily' # Replace with another secure long random key

# Hostnames & Security
ALLOWED_HOSTS=api.examintel.in,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://www.examintel.in,https://examintel.in
FRONTEND_URL=https://examintel.in

# Database (Neon serverless PostgreSQL connection string)
DATABASE_URL=postgresql://neondb_owner:npg_2Ca4rkjfJKcu@ep-morning-wind-aomm30bm-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Redis (Upstash secure redis SSL connection strings - db 0)
REDIS_URL="rediss://default:gQAAAAAAAeuHAAIgcDJmNDQ2NmE2NWRlOWQ0ZTA0YWIyYzhmN2YzYjI5OGVmNw@subtle-glowworm-125831.upstash.io:6379"
REDIS_CACHE_URL="rediss://default:gQAAAAAAAeuHAAIgcDJmNDQ2NmE2NWRlOWQ0ZTA0YWIyYzhmN2YzYjI5OGVmNw@subtle-glowworm-125831.upstash.io:6379"
REDIS_SESSION_URL="rediss://default:gQAAAAAAAeuHAAIgcDJmNDQ2NmE2NWRlOWQ0ZTA0YWIyYzhmN2YzYjI5OGVmNw@subtle-glowworm-125831.upstash.io:6379"

# Celery Task Execution
CELERY_TASK_ALWAYS_EAGER=False

# Gemini API Integration
GEMINI_API_KEY=AIzaSyCLe3gSLyoEdAoXaQtTJyTs46V3CGJxBow

# Administrator configuration
ADMIN_USERNAME=admin@examintel
ADMIN_PASSWORD=Admin@examintel123
ADMIN_EMAIL=divyanshusai47@gmail.com
```

---

## Step 4: Run the Production Docker Compose Stack

Start all containers in detached/background mode:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This compiles your Next.js frontend (production build pointing to `api.examintel.in`), prepares Django, and launches all Celery workers, Celery beat, and Flower. Because databases are hosted externally, **no local Postgres or Redis services are run on your VPS**, saving a significant amount of RAM and CPU!

### Check Status:
```bash
docker compose -f docker-compose.prod.yml ps
```
Ensure all containers are healthy or show `running`.

---

## Step 5: Run Django Setup (Migrations, Admin, Data)

Apply migrations and initialize the administrator account on the Neon database:

```bash
# 1. Apply Django DB Migrations to Neon DB
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 2. Create Django Superuser
docker compose -f docker-compose.prod.yml exec backend python manage.py create_admin
```

### Optional: Load existing data into Neon DB
If you have local data that you dumped into `datadump.json` (via `python manage.py dumpdata` locally):
```bash
# Copy datadump.json from your local machine to the VPS
scp backend/datadump.json root@your_vps_ip:/var/www/ai_exam_engine/backend/

# On the VPS, load the data into the database
docker compose -f docker-compose.prod.yml exec backend python manage.py loaddata datadump.json
```

---

## Step 6: Configure Nginx as a Reverse Proxy

We will configure Nginx on the host machine to handle traffic on ports 80 (HTTP) and 443 (HTTPS), routing it to Next.js, Django, and static folders.

Create the configuration file:

```bash
sudo nano /etc/nginx/sites-available/examintel
```

Paste the following configuration:

```nginx
# 1. Next.js Frontend reverse proxy
server {
    server_name examintel.in www.examintel.in;

    location / {
        proxy_pass http://127.0.0.1:4005; # Points to Frontend Next.js Docker
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Django API, Admin Panel & Flower reverse proxy
server {
    server_name api.examintel.in;

    # Serve django static files directly (efficient)
    location /static/ {
        alias /var/lib/docker/volumes/ai_exam_engine_django_prod_static/_data/;
    }

    # Serve django media files directly (user uploads)
    location /media/ {
        alias /var/lib/docker/volumes/ai_exam_engine_django_prod_media/_data/;
    }

    # Celery Flower monitoring dashboard
    location /flower/ {
        proxy_pass http://127.0.0.1:5555/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8000; # Points to Django Gunicorn Docker
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M; # Allowed size for PDF uploads
    }
}
```

Enable the configuration and restart Nginx:

```bash
# Link config to sites-enabled
sudo ln -s /etc/nginx/sites-available/examintel /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Obtain Let's Encrypt SSL Certificates (HTTPS)

Secure your deployment with free SSL certificates using Certbot:

```bash
sudo certbot --nginx -d examintel.in -d www.examintel.in -d api.examintel.in
```

- Follow the prompts (enter your email, accept terms).
- Select **Redirect** to force all traffic to HTTPS.
- Certbot will automatically edit your Nginx files to handle SSL and set up automatic certificate renewals.

---

## Operations & Maintenance Commands

### Restart Services
```bash
docker compose -f docker-compose.prod.yml restart
```

### View Live Logs
```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Pull Updates & Redeploy
Whenever you push new changes to main, run this on the VPS to redeploy:
```bash
cd /var/www/ai_exam_engine
git pull
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```
This pulls the new code, rebuilds containers, runs database migrations, and updates the deployment.
