# Google Cloud Run Deployment Guide

This guide details how to deploy the **AI Exam Engine** (Django + Next.js + PostgreSQL) to Google Cloud Run.

## Prerequisites
1.  **Google Cloud Account** (Free tier is sufficient for testing).
2.  **gcloud CLI** installed and authenticated (`gcloud auth login`).
3.  **Docker Desktop** running.

## 1. Initial Setup
Set your project ID and region variables for convenience:
```bash
export PROJECT_ID=your-google-cloud-project-id
export REGION=us-central1
gcloud config set project $PROJECT_ID
```

Enable necessary services:
```bash
gcloud services enable run.googleapis.com \
    sqladmin.googleapis.com \
    compute.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com
```

## 2. Database Setup (Cloud SQL)
Cloud Run needs a database. We'll set up a PostgreSQL instance.

1.  **Create Instance**:
    ```bash
    gcloud sql instances create exam-db \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --root-password=DB_PASSWORD_HERE
    ```
2.  **Create Database**:
    ```bash
    gcloud sql databases create exam_engine --instance=exam-db
    ```
3.  **Get Connection Name**:
    ```bash
    gcloud sql instances describe exam-db --format='value(connectionName)'
    # copy this value, e.g., project-id:region:exam-db
    ```

## 3. Build & Push Images
We need to store our Docker images in Google Artifact Registry.

1.  **Create Repository**:
    ```bash
    gcloud artifacts repositories create exam-repo \
        --repository-format=docker \
        --location=$REGION
    ```
2.  **Configure Docker**:
    ```bash
    gcloud auth configure-docker $REGION-docker.pkg.dev
    ```
3.  **Build & Push Backend**:
    ```bash
    docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/backend:latest ./backend
    docker push $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/backend:latest
    ```
4.  **Build & Push Frontend**:
    ```bash
    docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/frontend:latest ./frontend
    docker push $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/frontend:latest
    ```

## 4. Deploy Backend
Deploy Django as a Cloud Run service.

```bash
gcloud run deploy exam-backend \
    --image $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/backend:latest \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars="DEBUG=False" \
    --set-env-vars="SECRET_KEY=generate_a_secure_random_key" \
    --set-env-vars="GEMINI_API_KEY=your_gemini_key" \
    --set-env-vars="ALLOWED_HOSTS=*" \
    --set-env-vars="DATABASE_URL=postgresql://postgres:DB_PASSWORD_HERE@/exam_engine?host=/cloudsql/INSTANCE_CONNECTION_NAME" \
    --add-cloudsql-instances=INSTANCE_CONNECTION_NAME
```
*Note: Replace `INSTANCE_CONNECTION_NAME` and `DB_PASSWORD_HERE` with your actual values.*

**Run Migrations:**
Cloud Run is stateless, so we run migrations as a one-off job or utilizing a temporary container connected to the same DB.
For simplicity in this guide, run from your local machine using the Cloud SQL Proxy, or use the "Jobs" feature in Cloud Run console to run `python manage.py migrate`.

## 5. Deploy Frontend
Deploy Next.js as a Cloud Run service.

First, get the URL of the deployed backend (e.g., `https://exam-backend-xyz.a.run.app`).

```bash
gcloud run deploy exam-frontend \
    --image $REGION-docker.pkg.dev/$PROJECT_ID/exam-repo/frontend:latest \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_API_BASE_URL=https://exam-backend-xyz.a.run.app/api"
```

## 6. Verification
Visit the URL provided by the Frontend deployment command!

## Important Notes on Static Files
Django on Cloud Run doesn't serve static files efficiently without help.
- **Current Setup**: Usage of `whitenoise` (already in your `settings.py`) allows Django to serve its own static files, which is perfect for Cloud Run.
- **Media Files**: Uploaded PDFs will be lost on container restart. For production, configure **Google Cloud Storage** in `settings.py` for `DEFAULT_FILE_STORAGE`.
