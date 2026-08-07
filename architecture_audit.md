# Architecture & Code Structure Audit

This document outlines the findings of an architectural and code structure audit for the ExamIntel platform. The review covers both the Django backend and the Next.js frontend, highlighting strengths, structural patterns, and areas for improvement.

## 1. High-Level Architecture Overview
ExamIntel employs a modern, decoupled architecture:
- **Frontend**: Next.js 14 App Router, built with TypeScript, Tailwind CSS, and Shadcn UI.
- **Backend**: Django (Django REST Framework) with Celery for background processing.
- **AI Integration**: A modular AI engine built inside Django interacting with Google Gemini.

The separation of concerns at the macro level (Frontend vs. Backend API vs. Background Workers) is sound and scales well.

---

## 2. Backend (Django) Review

### Strengths & Good Patterns
1. **Modularity in AI Services (`quiz/ai/`)**:
   - The AI logic is excellently decoupled. Instead of a single massive script, it is broken down into domain-specific modules: `gemini_client.py`, `prompt_builder.py`, `question_analyzer.py`, `summary_service.py`, etc. This makes the AI pipeline highly testable and maintainable.
2. **Background Task Infrastructure (`tasks/base.py`)**:
   - The implementation of `BaseTask` with built-in deduplication locks (`acquire_job_lock`), retries, and unified logging is an excellent architectural choice for reliable Celery job execution.
3. **View Decomposition Strategy (`quiz/api_*.py`)**:
   - The `quiz` app attempts to split large views by utilizing multiple mixin files (`api_dashboard.py`, `api_session.py`, `api_summary.py`). This prevents a single view from becoming an unmanageable monolith.

### Areas for Improvement
1. **Fat Models and Monolithic Files**:
   - `quiz/models.py` is nearly 700 lines long. As the app grows, this will become difficult to navigate.
   - **Recommendation**: Convert `models.py` into a `models/` directory package (`models/__init__.py`, `models/exam.py`, `models/question.py`, `models/category.py`, etc.).
2. **Fat Views in Community App**:
   - Unlike the `quiz` app, `community/views.py` is quite large (nearly 20,000 bytes) and appears to house complex business logic (e.g., `ProfileViewSet` aggregating stats across different apps).
   - **Recommendation**: Move aggregation and complex business logic into dedicated service functions inside `community/services.py`, keeping the views purely responsible for request/response serialization.
3. **API Routing Structure in Quiz App**:
   - While mixins (`api_*.py`) are used to break down the API, having them floating in the `quiz/` root alongside `api.py` and `views_auth.py` creates clutter.
   - **Recommendation**: Create an `api/` directory (e.g., `quiz/api/views/`, `quiz/api/serializers/`, `quiz/api/urls.py`) to encapsulate API-related files.

---

## 3. Frontend (Next.js) Review

### Strengths & Good Patterns
1. **App Router Organization**:
   - The `src/app/` directory is well-structured with clear, feature-based routing patterns (e.g., dynamic routes like `[examId]`, explicit loading states).
2. **Component Granularity**:
   - Components are broken down logically in `src/components/` (e.g., `exam-card.tsx`, `timer.tsx`, `latex-renderer.tsx`). This encourages reusability.
3. **Authentication Context**:
   - `AuthContext` provides a clean global state for user authentication, separating the data-fetching logic from the UI.

### Areas for Improvement
1. **API Client Redundancy & Cleanup**:
   - There are currently two API abstractions: `src/lib/api.ts` (using Axios) and `src/lib/apiClient.ts` (using Fetch, marked as deprecated).
   - **Recommendation**: Complete the migration to Axios and delete the deprecated `apiClient.ts` file to avoid developer confusion.
2. **Error Handling UX**:
   - In `api.ts`, there are hardcoded `alert()` calls (e.g., `alert('Configuration Error...')`).
   - **Recommendation**: Remove native `alert()` calls from the API layer. Instead, throw custom errors and handle them gracefully in the UI layer using toast notifications (e.g., Shadcn toasts) or error boundaries.
3. **Component Colocation vs. Centralization**:
   - `src/components/` is becoming quite large and flat.
   - **Recommendation**: Consider adopting a feature-based folder structure where components specific to a single route (e.g., `performance-analysis.tsx`) live closer to their respective route in `src/app/`, reserving `src/components/` purely for shared/global UI components (like buttons, navbars, and layouts).

---

## 4. Summary & Next Steps

Overall, ExamIntel is built on a solid architectural foundation. The modularity of the AI backend and the adoption of background task patterns are particularly impressive.

The primary next steps to improve the codebase structure are:
1. **Refactor Django file organization** (split `models.py`, create an `api/` package).
2. **Thin out Django views**, specifically in the `community` app, by migrating logic to services.
3. **Cleanup frontend API layers** (delete deprecated files and refine error handling).
