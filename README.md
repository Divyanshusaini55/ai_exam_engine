# AI Exam Engine

A full-stack application for generating and conducting AI-powered exams from PDF documents using Google's Gemini AI.

## Project Structure

```
ai-exam-engine/
├── backend/                # Django (Port 8000)
│   ├── manage.py
│   ├── core/               # Project Settings (settings.py, urls.py)
│   ├── quiz/               # The App Logic
│   │   ├── models.py       # DB Schema
│   │   ├── ai.py           # Gemini AI Script
│   │   ├── api.py          # API Views (DRF)
│   │   └── admin.py        # Admin Panel to upload PDF
│   └── media/              # Folder for uploaded PDFs
│
└── frontend/               # Next.js (Port 3000)
    ├── package.json
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx          # List of Exams
    │   │   └── test/
    │   │       └── [id]/page.tsx # The Test Interface
    │   └── components/
    │       ├── Timer.tsx
    │       └── QuestionCard.tsx
```

## Setup Instructions

### Backend Setup (Django)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up environment variables:
   ```bash
   export GEMINI_API_KEY="your-gemini-api-key-here"
   ```
   Or create a `.env` file in the backend directory with:
   ```
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

5. Run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

6. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

7. Run the development server:
   ```bash
   python manage.py runserver
   ```

   The backend will be available at `http://localhost:8000`

8. Access the admin panel at `http://localhost:8000/admin` to upload PDFs and generate exams.

### Frontend Setup (Next.js)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

## Usage

1. **Create an Exam:**
   - Go to `http://localhost:8000/admin`
   - Log in with your superuser credentials
   - Navigate to "Exams"
   - Click "Add Exam"
   - Fill in the exam details (title, description, duration, number of questions)
   - Upload a PDF file
   - Save the exam
   - Questions will be automatically generated using Gemini AI

2. **Take an Exam:**
   - Go to `http://localhost:3000`
   - Select an exam from the list
   - Answer the questions
   - Submit your exam when finished

## API Endpoints

- `GET /api/exams/` - List all active exams
- `GET /api/exams/{id}/` - Get exam details
- `GET /api/exams/{id}/questions/` - Get questions for an exam
- `POST /api/exams/{id}/submit_answer/` - Submit an answer
- `GET /api/exams/{id}/results/?session_id={session_id}` - Get exam results

## Technologies Used

### Backend:
- Django 4.2
- Django REST Framework
- Google Gemini AI
- PyPDF2
- SQLite (default, can be changed to PostgreSQL)

### Frontend:
- Next.js 14
- React 18
- TypeScript

## Notes

- Make sure to set your `GEMINI_API_KEY` environment variable before running the backend
- The PDFs should contain readable text (not scanned images)
- Questions are generated automatically when a PDF is uploaded via the admin panel
