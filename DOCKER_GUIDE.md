# Docker Run Guide

This guide explains how to run the AI Exam Engine using Docker.

## Prerequisites
- **Docker Desktop** installed and running.

## 1. Start the Application
To build and start all services (Frontend, Backend, Database, Redis):

```bash
docker compose up --build
```
*The `--build` flag ensures that any changes you make to the code are included.*

## 2. Access the App
Once the logs show that the server is running:

| Service | URL |
| :--- | :--- |
| **Frontend** | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) |
| **Admin Panel** | [http://localhost:8000/admin](http://localhost:8000/admin) |

## 3. Stop the Application
To stop the containers, press `Ctrl+C` in the terminal where it's running.

To remove the containers (clean up):
```bash
docker compose down
```

## Common Commands

### View Logs
If you are running in detached mode (`-d`), view logs with:
```bash
docker compose logs -f
```

### Rebuild Specific Service
If you changed only the backend code:
```bash
docker compose up --build backend
```

### Reset Database
To completely wipe the database and start fresh:
```bash
docker compose down -v
docker compose up --build
```
