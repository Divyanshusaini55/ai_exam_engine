import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logApi, logAbort } from './debug';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://ai-exam-engine-backend.onrender.com/api';

if (typeof window !== 'undefined') {
  console.log(' API_URL Configured as:', API_URL);
  if (window.location.hostname.includes('vercel.app') && (API_URL.includes('127.0.0.1') || API_URL.includes('localhost'))) {
    console.error(' CRITICAL ERROR: Production App is trying to connect to Localhost! Check NEXT_PUBLIC_API_BASE_URL in Vercel Settings.');
    alert('Configuration Error: App is trying to connect to localhost. Please report this.');
  }
}

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
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
  // Add timeout and better error handling
  timeout: 10000,
});

// Add Request Interceptor to include Auth Token
api.interceptors.request.use((config) => {
  logApi(config.url || '', config.method?.toUpperCase(), 'START');
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem("auth_token")
    if (token) {
      config.headers.Authorization = `Token ${token}`
    }
  }
  return config
})

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    logApi(response.config.url || '', response.config.method?.toUpperCase(), `END - Status: ${response.status}`);
    return response;
  },
  (error) => {
    if (axios.isCancel(error)) {
        logAbort(error.config?.url || '');
    } else {
        logApi(error.config?.url || '', error.config?.method?.toUpperCase(), `ERROR - ${error.message}`);
    }
    if (process.env.NODE_ENV === 'development') {
        console.error('API Error:', error.config?.url, error.response?.status, error.message);
    }
    return Promise.reject(error);
  }
);

export const examApi = {
  // Get list of all exams (filters can be applied in frontend)
  list: (params?: any) => api.get('/exams/', { params }),

  // Get details (questions) for a specific exam
  get: (id: string, params?: any) => api.get(`/exams/${id}/`, { params }),

  // Get questions for the "Taking Interface"
  getQuestions: (id: string, params?: any) => api.get(`/exams/${id}/questions/`, { params }),

  // Submit a single answer (Background Auto-save)
  submitAnswer: (
    examId: string,
    questionId: number,
    answerId?: number | null,
    sessionId?: string | null,
    isFlaggedForReview?: boolean,
    isBookmarked?: boolean
  ) => {
    return api.post(`/exams/${examId}/submit_answer/`, {
      session_id: sessionId || getSessionId(),
      question_id: questionId,
      answer_id: answerId,
      is_flagged_for_review: isFlaggedForReview,
      is_bookmarked: isBookmarked,
    });
  },

  // NEW: Start exam/learning session
  startSession: (examId: string, mode: 'exam' | 'learning', sessionId?: string | null) => {
    return api.post(`/exams/${examId}/start/`, {
      mode,
      session_id: sessionId
    });
  },

  // NEW: Submit entire exam/practice to calculate results
  submitExam: (examId: string, sessionId: string, mode: 'exam' | 'learning' = 'exam', duration = 0) => {
    return api.post(`/exams/${examId}/submit/`, {
      session_id: sessionId,
      mode,
      duration
    });
  },

  // NEW: Pause session
  pauseSession: (examId: string, sessionId: string, mode: 'exam' | 'learning', duration: number) => {
    return api.post(`/exams/${examId}/pause/`, {
      session_id: sessionId,
      mode,
      duration
    });
  },

  // NEW: Reset session
  resetSession: (examId: string, sessionId: string, mode: 'exam' | 'learning') => {
    return api.post(`/exams/${examId}/reset/`, {
      session_id: sessionId,
      mode
    });
  },

  // NEW: Update session state (current question index, duration, visited status)
  updateSession: (
    examId: string,
    sessionId: string,
    mode: 'exam' | 'learning',
    duration: number,
    currentQuestionIndex: number,
    questionId?: number | null
  ) => {
    return api.post(`/exams/${examId}/update_session/`, {
      session_id: sessionId,
      mode,
      duration,
      current_question_index: currentQuestionIndex,
      question_id: questionId,
    });
  },

  // Get Final Results
  getResults: (examId: string, sessionId?: string | null) => {
    return api.get(`/exams/${examId}/results/`, {
      params: { session_id: sessionId || getSessionId() }
    });
  },

  // NEW: Request AI explanation for a specific question
  explainQuestion: (questionId: number) => {
    return api.post(`/exams/explain_question/`, {
      question_id: questionId
    });
  },

  // NEW: Get Leaderboard
  getLeaderboard: (examId?: string) => {
    return api.get('/exams/leaderboard/', {
      params: { exam_id: examId }
    });
  },

  // NEW: Upload Question Paper
  uploadPaper: (data: FormData) => {
    return api.post('/uploads/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // NEW: Suggestions API
  getSuggestions: (questionId: number) => api.get('/suggestions/', { params: { question_id: questionId } }),
  submitSuggestion: (data: any) => api.post('/suggestions/', data),
  upvoteSuggestion: (id: number) => api.post(`/suggestions/${id}/upvote/`),
  
  // NEW: Get current progress for an exam (to restore on refresh)
  getProgress: (examId: string, sessionId?: string | null) => api.get(`/exams/${examId}/progress/`, {
    params: { session_id: sessionId || getSessionId() }
  }),

  // NEW: Get exam summary (dynamically generates if not present)
  getSummary: (id: string, params?: any) => api.get(`/exams/${id}/summary/`, { params }),
};

export const communityApi = {
  getComments: (questionId: number) => api.get('/community/comments/', { params: { question: questionId } }),
  getMyComments: () => api.get('/community/comments/', { params: { user: 'me' } }),
  postComment: (data: { question: number; text: string; parent?: number }) => api.post('/community/comments/', data),
  updateComment: (commentId: number, text: string) => api.patch(`/community/comments/${commentId}/`, { text }),
  deleteComment: (commentId: number) => api.delete(`/community/comments/${commentId}/`),
  upvoteComment: (commentId: number) => api.post(`/community/comments/${commentId}/upvote/`),
  getProfile: () => api.get('/community/profiles/me/'),
  getNotifications: (config?: any) => api.get('/community/notifications/', config),
  readNotification: (id: number) => api.post(`/community/notifications/${id}/read/`),
};

export const dailyDoseApi = {
  getCurrentAffairs: (categorySlug?: string) => {
    const params = categorySlug ? { category: categorySlug } : {}
    return api.get('/current-affairs/', { params })
  },
  getAffairBySlug: (slug: string) => api.get(`/current-affairs/${slug}/`),
};

export const roadmapApi = {
  getRoadmap: (subcategorySlug: string) => api.get(`/roadmaps/${subcategorySlug}/`),
  updateTopicStatus: (topicId: number, status: string) => api.post(`/roadmaps/topics/${topicId}/status/`, { status }),
  toggleRoadmapBookmark: (subcategorySlug: string) => api.post(`/roadmaps/${subcategorySlug}/bookmark/`),
};

const COMM = '/community';
export const contributorApi = {
  /** Global community overview stats */
  getOverview: () => api.get(`${COMM}/contributors/`),
  /** Rich stats for the currently logged-in user */
  getMyStats: () => api.get(`${COMM}/contributors/stats/me/`),
  /** Paginated global top contributors */
  getTop: (page = 1, perPage = 10) =>
    api.get(`${COMM}/contributors/top/`, { params: { page, per_page: perPage } }),
  /** Recent community activity feed */
  getActivity: (page = 1) =>
    api.get(`${COMM}/contributors/activity/`, { params: { page } }),
  /** Category-wise leaderboards */
  getLeaderboard: (days = 30) =>
    api.get(`${COMM}/contributors/leaderboard/`, { params: { days } }),
  /** All badges + earned status for current user */
  getBadges: () => api.get(`${COMM}/contributors/badges/`),
  /** Public profile for any username */
  getProfile: (username: string) =>
    api.get(`${COMM}/contributors/profile/${username}/`),
};