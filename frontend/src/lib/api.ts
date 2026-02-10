import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://127.0.0.1:8000/api';

// Helper: Get or create a unique session ID for the user
export const getSessionId = () => {
  if (typeof window !== 'undefined') {
    let session = localStorage.getItem('exam_session_id');
    if (!session) {
      session = uuidv4();
      localStorage.setItem('exam_session_id', session);
    }
    return session;
  }
  return '';
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout and better error handling
  timeout: 10000,
});

// ✅ Add Request Interceptor to include Auth Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem("auth_token")
    if (token) {
      config.headers.Authorization = `Token ${token}`
    }
  }
  return config
})

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status, response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.config?.url, error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export const examApi = {
  // Get list of all exams (filters can be applied in frontend)
  list: (params?: any) => api.get('/exams/', { params }),

  // Get details (questions) for a specific exam
  get: (id: string) => api.get(`/exams/${id}/`),

  // Get questions for the "Taking Interface"
  getQuestions: (id: string) => api.get(`/exams/${id}/questions/`),

  // Submit a single answer (Background Auto-save)
  submitAnswer: (examId: string, questionId: number, answerId: number) => {
    return api.post(`/exams/${examId}/submit_answer/`, {
      session_id: getSessionId(),
      question_id: questionId,
      answer_id: answerId,
    });
  },

  // Get Final Results
  getResults: (examId: string) => {
    return api.get(`/exams/${examId}/results/`, {
      params: { session_id: getSessionId() }
    });
  },

  // 🔥 NEW: Request AI explanation for a specific question
  explainQuestion: (questionId: number) => {
    return api.post(`/exams/explain_question/`, {
      question_id: questionId
    });
  },

  // 🏆 NEW: Get Leaderboard
  getLeaderboard: (examId?: string) => {
    return api.get('/exams/leaderboard/', {
      params: { exam_id: examId }
    });
  }
};