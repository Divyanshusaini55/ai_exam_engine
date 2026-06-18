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

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  logApi(config.url || '', config.method?.toUpperCase(), 'START');
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem("auth_token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    logApi(response.config.url || '', response.config.method?.toUpperCase(), `END - Status: ${response.status}`);
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
        logAbort(error.config?.url || '');
    } else {
        logApi(error.config?.url || '', error.config?.method?.toUpperCase(), `ERROR - ${error.message}`);
    }
    if (process.env.NODE_ENV === 'development' && !axios.isCancel(error)) {
        const isExpected404 = error.response?.status === 404 && error.config?.url?.includes('/results/');
        if (!isExpected404) {
            console.error('API Error:', error.config?.url, error.response?.status, error.message);
        }
    }
    
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        if (typeof window !== 'undefined') {
            const refreshToken = localStorage.getItem("refresh_token");
            if (refreshToken) {
                try {
                    const res = await axios.post(`${API_URL}/auth/token/refresh/`, {
                        refresh: refreshToken
                    });
                    if (res.status === 200) {
                        localStorage.setItem("auth_token", res.data.access);
                        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("refresh_token");
                    window.location.href = '/login';
                }
            } else {
                localStorage.removeItem("auth_token");
                if (originalRequest.headers) {
                    delete originalRequest.headers.Authorization;
                }
                return api(originalRequest);
            }
        }
    }
    
    return Promise.reject(error);
  }
);

export const examApi = {
  list: (params?: any) => api.get('/exams/', { params }),

  getCategories: () => api.get('/categories/'),
  getSubcategories: (params?: any) => api.get('/subcategories/', { params }),

  get: (id: string, params?: any) => api.get(`/exams/${id}/`, { params }),

  getQuestions: (id: string, params?: any) => api.get(`/exams/${id}/questions/`, { params }),

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

  startSession: (examId: string, mode: 'exam' | 'learning', sessionId?: string | null) => {
    return api.post(`/exams/${examId}/start/`, {
      mode,
      session_id: sessionId
    });
  },

  submitExam: (examId: string, sessionId: string, mode: 'exam' | 'learning' = 'exam', duration = 0) => {
    return api.post(`/exams/${examId}/submit/`, {
      session_id: sessionId,
      mode,
      duration
    });
  },

  pauseSession: (examId: string, sessionId: string, mode: 'exam' | 'learning', duration: number) => {
    return api.post(`/exams/${examId}/pause/`, {
      session_id: sessionId,
      mode,
      duration
    });
  },

  resetSession: (examId: string, sessionId: string, mode: 'exam' | 'learning') => {
    return api.post(`/exams/${examId}/reset/`, {
      session_id: sessionId,
      mode
    });
  },

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

  getResults: (examId: string, sessionId?: string | null) => {
    return api.get(`/exams/${examId}/results/`, {
      params: { session_id: sessionId || getSessionId() }
    });
  },

  explainQuestion: (questionId: number) => {
    return api.post(`/exams/explain_question/`, {
      question_id: questionId
    });
  },

  getLeaderboard: (examSlug?: string) => {
    return api.get('/exams/leaderboard/', {
      params: { exam_slug: examSlug }
    });
  },

  uploadPaper: (data: FormData) => {
    return api.post('/uploads/', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  getSuggestions: (questionId: number) => api.get('/suggestions/', { params: { question_id: questionId } }),
  submitSuggestion: (data: any) => api.post('/suggestions/', data),
  upvoteSuggestion: (id: number) => api.post(`/suggestions/${id}/upvote/`),
  
  getProgress: (examId: string, sessionId?: string | null) => api.get(`/exams/${examId}/progress/`, {
    params: { session_id: sessionId || getSessionId() }
  }),

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
  getCurrentAffairs: (categorySlug?: string, page: number = 1) => {
    const params: any = { page }
    if (categorySlug) params.category = categorySlug
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
  getOverview: () => api.get(`${COMM}/contributors/`),
  getMyStats: () => api.get(`${COMM}/contributors/stats/me/`),
  getTop: (page = 1, perPage = 10) =>
    api.get(`${COMM}/contributors/top/`, { params: { page, per_page: perPage } }),
  getActivity: (page = 1) =>
    api.get(`${COMM}/contributors/activity/`, { params: { page } }),
  getLeaderboard: (days = 30) =>
    api.get(`${COMM}/contributors/leaderboard/`, { params: { days } }),
  getBadges: () => api.get(`${COMM}/contributors/badges/`),
  getProfile: (username: string) =>
    api.get(`${COMM}/contributors/profile/${username}/`),
};

const legacyFetch = async (method: 'get' | 'post' | 'put' | 'delete' | 'patch', url: string, data?: any, config?: any) => {
  try {
    const res = await api({ method, url, data, ...config });
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      json: async () => res.data
    };
  } catch (error: any) {
    if (error.response) {
      return {
        ok: false,
        status: error.response.status,
        json: async () => error.response.data
      };
    }
    throw error;
  }
};

export const authApi = {
  login: (data: any) => legacyFetch('post', '/auth/login/', data),
  register: (data: any) => legacyFetch('post', '/auth/register/', data),
  getUser: (signal?: AbortSignal) => legacyFetch('get', '/auth/user/', undefined, { signal }),
  resetPassword: (email: string) => legacyFetch('post', '/auth/password-reset/', { email }),
  resetPasswordConfirm: (data: any) => legacyFetch('post', '/auth/password-reset/confirm/', data),
};

export const adminApi = {
  getContactMessages: () => legacyFetch('get', '/admin/contact-messages/'),
  updateContactMessageStatus: (id: number, status: string) => legacyFetch('patch', `/admin/contact-messages/${id}/status/`, { status }),
  deleteContactMessage: (id: number) => legacyFetch('delete', `/admin/contact-messages/${id}/`),
};

export const miscApi = {
  submitContactForm: (data: any) => legacyFetch('post', '/contact/submit/', data),
  getDashboardStats: () => legacyFetch('get', '/exams/dashboard_stats/'),
};

export const resourceHubApi = {
  markDone: (slug: string) => legacyFetch('post', `/resource-hub/${slug}/mark-done/`),
  bookmark: (slug: string) => legacyFetch('post', `/resource-hub/${slug}/bookmark/`),
};