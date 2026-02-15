# AI Exam Engine

A powerful, full-stack **AI-powered Exam Platform** that automatically generates quizzes and exams from PDF documents using **Google's Gemini AI**. 

It features a modern **Next.js frontend** and a robust **Django backend**, supporting both guest and authenticated users, real-time performance analysis, and a competitive leaderboard.

---

## Key Features

### AI-Powered Generation
-   **PDF to Exam**: Upload any PDF (textbooks, notes, papers) and instantly generate a structured exam.
-   **Smart Question Parsing**: Uses Gemini AI to create Multiple Choice, True/False, and Short Answer questions.
-   **Auto-Grading**: Instant results with detailed explanations for every answer.

### User Experience
-   **Guest Mode**: Take exams instantly without creating an account (results saved via session).
-   **User Accounts**: Sign up to track history, view analytics, and save progress.
-   **Responsive Design**: Fully optimized unique interface for Mobile, Tablet, and Desktop.

### Analytics & Gamification
-   **Performance Dashboard**: Detailed breakdown of accuracy, time spent, and weak areas.
-   **Leaderboard**: Compare scores with other users globally or per exam.
-   **History**: Review past attempts and learn from mistakes.

---

## Tech Stack

### **Frontend**
-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS + Shadcn UI (Radix Primitives)
-   **State/Fetching**: React Hooks, Axios
-   **Icons**: Lucide React

### **Backend**
-   **Framework**: [Django 4.2](https://www.djangoproject.com/)
-   **API**: Django REST Framework (DRF)
-   **AI Engine**: Google Gemini Pro (`google-generativeai`)
-   **Database**: PostgreSQL (Production) / SQLite (Development)
-   **PDF Processing**: PyPDF2
-   **Caching**: Redis (Optional for production)

---

## Getting Started

Follow these instructions to set up the project locally.

### **Prerequisites**
-   Python 3.9+
-   Node.js 18+
-   Google Gemini API Key ([Get it here](https://makersuite.google.com/app/apikey))

### **1. Backend Setup (Django)**

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
# Create a file named .env in the backend/ folder and add:
echo "GEMINI_API_KEY=your_api_key_here" > .env
echo "DEBUG=True" >> .env
echo "SECRET_KEY=dev_secret_key" >> .env

# 5. Run Migrations
python manage.py makemigrations
python manage.py migrate

# 6. Create Superuser (Admin)
python manage.py createsuperuser

# 7. Start Server
python manage.py runserver
```
*Backend runs on `http://localhost:8000`*

### **2. Frontend Setup (Next.js)**

```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Configure Environment
# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api" > .env.local

# 4. Start Dev Server
npm run dev
```
*Frontend runs on `http://localhost:3000`*

### **3. Docker Setup (Recommended)**

If you have Docker installed, you can run the entire stack with a single command:

```bash
# Build and start services
docker-compose up --build
```

- **Backend**: `http://localhost:8000`
- **Frontend**: `http://localhost:3000`
- **PostgreSQL**: `localhost:5435`
- **Redis**: `localhost:6379`

To stop the services:
```bash
docker-compose down
```

---

## Usage Guide

### **Creating an Exam (Admin)**
1.  Go to `http://localhost:8000/admin`.
2.  Login with your superuser account.
3.  Navigate to **Exams** > **Add Exam**.
4.  Fill in details (Title, Duration).
5.  **Upload a PDF** in the "PDF File" field.
6.  Click **Save**. The AI will process the PDF in the background and generate questions.

### **Taking an Exam**
1.  Go to `http://localhost:3000`.
2.  Browse available exams.
3.  Click **Start Exam**.
4.  Submit answers and view your instant score!

---

## Deployment

### **Backend (Render/Railway)**
1.  Set `DEBUG=False`.
2.  Add environment variables (`GEMINI_API_KEY`, `DATABASE_URL`, `SECRET_KEY`).
3.  Ensure `ALLOWED_HOSTS` includes your domain.
4.  Run `gunicorn core.wsgi:application`.

### **Frontend (Vercel)**
1.  Import repository to Vercel.
2.  Set `NEXT_PUBLIC_API_BASE_URL` to your production backend URL.
3.  Deploy!

---

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any improvements, bug fixes, or new features.

## License

This project is open-source and available under the [MIT License](LICENSE).
