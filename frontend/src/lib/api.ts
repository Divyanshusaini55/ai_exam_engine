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
    questionId: number | string,
    answerId?: number | string | null,
    sessionId?: string | null,
    isFlaggedForReview?: boolean,
    isBookmarked?: boolean,
    selectedOptions?: number[],
    textAnswer?: string,
    answerPayload?: any
  ) => {
    return api.post(`/exams/${examId}/submit_answer/`, {
      session_id: sessionId || getSessionId(),
      question_id: questionId,
      answer_id: answerId,
      selected_options: selectedOptions,
      text_answer: textAnswer,
      answer_payload: answerPayload,
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
  getCategories: () => api.get('/current-affairs/categories/'),
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
  getStats: () => legacyFetch('get', '/admin/stats/'),

  // Categories & Subcategories
  getCategories: () => legacyFetch('get', '/admin/categories/'),
  createCategory: (data: any) => legacyFetch('post', '/admin/categories/', data),
  updateCategory: (id: number, data: any) => legacyFetch('patch', `/admin/categories/${id}/`, data),
  deleteCategory: (id: number) => legacyFetch('delete', `/admin/categories/${id}/`),

  getSubcategories: () => legacyFetch('get', '/admin/subcategories/'),
  createSubcategory: (data: any) => legacyFetch('post', '/admin/subcategories/', data),
  updateSubcategory: (id: number, data: any) => legacyFetch('patch', `/admin/subcategories/${id}/`, data),
  deleteSubcategory: (id: number) => legacyFetch('delete', `/admin/subcategories/${id}/`),
  triggerRoadmap: (id: number) => legacyFetch('post', `/admin/subcategories/${id}/trigger_roadmap/`),

  // Topics
  getTopics: () => legacyFetch('get', '/admin/topics/'),
  createTopic: (data: any) => legacyFetch('post', '/admin/topics/', data),
  updateTopic: (id: number, data: any) => legacyFetch('patch', `/admin/topics/${id}/`, data),
  deleteTopic: (id: number) => legacyFetch('delete', `/admin/topics/${id}/`),

  // Exams & Questions
  getExams: (subcategory?: string) => legacyFetch('get', `/admin/exams/${subcategory ? `?subcategory=${subcategory}` : ''}`),
  createExam: (data: any) => legacyFetch('post', '/admin/exams/', data),
  updateExam: (id: number, data: any) => legacyFetch('patch', `/admin/exams/${id}/`, data),
  deleteExam: (id: number) => legacyFetch('delete', `/admin/exams/${id}/`),
  importExamJson: (id: number, data: any) => legacyFetch('post', `/admin/exams/${id}/import_json/`, data),
  exportExamJson: (id: number) => legacyFetch('get', `/admin/exams/${id}/export_json/`),

  getQuestions: (examId?: number | string, examSlug?: string) => {
    const params = new URLSearchParams()
    if (examId) params.append('exam_id', examId.toString())
    if (examSlug) params.append('exam_slug', examSlug)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return legacyFetch('get', `/admin/questions/${queryString}`)
  },
  createQuestion: (data: any) => legacyFetch('post', '/admin/questions/', data),
  updateQuestion: (id: number | string, data: any) => legacyFetch('patch', `/admin/questions/${id}/`, data),
  deleteQuestion: (id: number | string) => legacyFetch('delete', `/admin/questions/${id}/`),
  generateHindiQuestion: (id: number | string) => legacyFetch('post', `/admin/questions/${id}/generate_hindi/`),
  bulkGenerateHindiQuestions: (ids: (number | string)[]) => legacyFetch('post', '/admin/questions/bulk_generate_hindi/', { ids }),

  // Current Affairs
  getCurrentAffairs: (page: number = 1, search?: string) => {
    const params = new URLSearchParams()
    if (page) params.append('page', page.toString())
    if (search) params.append('search', search)
    const queryString = params.toString() ? `?${params.toString()}` : ''
    return legacyFetch('get', `/admin/current-affairs/${queryString}`)
  },
  createCurrentAffair: (data: any) => legacyFetch('post', '/admin/current-affairs/', data),
  updateCurrentAffair: (id: number, data: any) => legacyFetch('patch', `/admin/current-affairs/${id}/`, data),
  deleteCurrentAffair: (id: number) => legacyFetch('delete', `/admin/current-affairs/${id}/`),
  triggerAiCurrentAffairs: () => legacyFetch('post', '/admin/current-affairs/trigger_ai_gen/'),

  // Users
  getUsers: (search?: string) => legacyFetch('get', `/admin/users/${search ? `?search=${search}` : ''}`),
  getUser: (id: string | number) => legacyFetch('get', `/admin/users/${id}/`),
  updateUser: (id: number, data: any) => legacyFetch('patch', `/admin/users/${id}/`, data),
  getUserProgress: (id: string | number) => legacyFetch('get', `/admin/users/${id}/progress/`),
  toggleUserStaff: (id: number, password?: string) => legacyFetch('post', `/admin/users/${id}/toggle_staff/`, { password }),
  toggleUserActive: (id: number) => legacyFetch('post', `/admin/users/${id}/toggle_active/`),

  // PDF Uploads
  getUploads: () => legacyFetch('get', '/admin/uploads/'),
  uploadPdf: (formData: FormData) => api.post('/admin/uploads/', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteUpload: (id: number) => legacyFetch('delete', `/admin/uploads/${id}/`),

  // Messages & Suggestions
  getContactMessages: () => legacyFetch('get', '/admin/messages/'),
  toggleMessageResolve: (id: number) => legacyFetch('post', `/admin/messages/${id}/toggle_resolve/`),
  updateContactMessageStatus: (id: number, status: string) => legacyFetch('post', `/admin/messages/${id}/update_status/`, { status }),
  deleteContactMessage: (id: number) => legacyFetch('delete', `/admin/messages/${id}/`),

  getSuggestions: () => legacyFetch('get', '/admin/suggestions/'),
  updateSuggestionStatus: (id: number, status: string) => legacyFetch('post', `/admin/suggestions/${id}/update_status/`, { status }),
  bulkUpdateSuggestionStatus: (ids: number[], status: string) => legacyFetch('post', '/admin/suggestions/bulk_update_status/', { ids, status }),
  deleteSuggestion: (id: number) => legacyFetch('delete', `/admin/suggestions/${id}/`),

  // Study Hub Educational Resources
  getResources: () => legacyFetch('get', '/admin/resources/'),
  createResource: (data: any) => legacyFetch('post', '/admin/resources/', data),
  updateResource: (id: number, data: any) => legacyFetch('patch', `/admin/resources/${id}/`, data),
  deleteResource: (id: number) => legacyFetch('delete', `/admin/resources/${id}/`),
  bulkPublishResources: (ids: number[]) => legacyFetch('post', '/admin/resources/bulk_publish/', { ids }),
  bulkUnpublishResources: (ids: number[]) => legacyFetch('post', '/admin/resources/bulk_unpublish/', { ids }),
  bulkFeatureResources: (ids: number[]) => legacyFetch('post', '/admin/resources/bulk_feature/', { ids }),
  bulkAiSummaryResources: (ids: number[]) => legacyFetch('post', '/admin/resources/bulk_ai_summary/', { ids }),
  
  getTags: () => legacyFetch('get', '/admin/tags/'),
  createTag: (data: any) => legacyFetch('post', '/admin/tags/', data),
  updateTag: (id: number, data: any) => legacyFetch('patch', `/admin/tags/${id}/`, data),
  deleteTag: (id: number) => legacyFetch('delete', `/admin/tags/${id}/`),

  getRoadmaps: () => legacyFetch('get', '/admin/roadmaps/'),
  getRoadmap: (id: string | number) => legacyFetch('get', `/admin/roadmaps/${id}/`),
  createRoadmap: (data: any) => legacyFetch('post', '/admin/roadmaps/', data),
  updateRoadmap: (id: number, data: any) => legacyFetch('patch', `/admin/roadmaps/${id}/`, data),
  deleteRoadmap: (id: number) => legacyFetch('delete', `/admin/roadmaps/${id}/`),

  getRoadmapPhases: (roadmapId: number) => legacyFetch('get', `/admin/roadmap-phases/?roadmap_id=${roadmapId}`),
  createRoadmapPhase: (data: any) => legacyFetch('post', '/admin/roadmap-phases/', data),
  updateRoadmapPhase: (id: number, data: any) => legacyFetch('patch', `/admin/roadmap-phases/${id}/`, data),
  deleteRoadmapPhase: (id: number) => legacyFetch('delete', `/admin/roadmap-phases/${id}/`),

  getRoadmapTopics: (phaseId: number) => legacyFetch('get', `/admin/roadmap-topics/?phase_id=${phaseId}`),
  createRoadmapTopic: (data: any) => legacyFetch('post', '/admin/roadmap-topics/', data),
  updateRoadmapTopic: (id: number, data: any) => legacyFetch('patch', `/admin/roadmap-topics/${id}/`, data),
  deleteRoadmapTopic: (id: number) => legacyFetch('delete', `/admin/roadmap-topics/${id}/`),

  getDashboardStats: () => legacyFetch('get', '/admin/stats/'),
  togglePublishResource: (id: number) => legacyFetch('post', `/admin/resources/${id}/toggle_publish/`),
  toggleFeatureResource: (id: number) => legacyFetch('post', `/admin/resources/${id}/toggle_feature/`),
  generateAiResourceSummary: (id: number) => legacyFetch('post', `/admin/resources/${id}/ai_summary/`),
};

export const communityAdminApi = {
  getProfiles: () => legacyFetch('get', '/community/admin/profiles/'),
  updateProfile: (id: number, data: any) => legacyFetch('patch', `/community/admin/profiles/${id}/`, data),
  
  getBadges: () => legacyFetch('get', '/community/admin/badges/'),
  createBadge: (data: any) => legacyFetch('post', '/community/admin/badges/', data),
  updateBadge: (id: number, data: any) => legacyFetch('patch', `/community/admin/badges/${id}/`, data),
  deleteBadge: (id: number) => legacyFetch('delete', `/community/admin/badges/${id}/`),
  
  getUserBadges: () => legacyFetch('get', '/community/admin/user-badges/'),
  awardBadge: (data: any) => legacyFetch('post', '/community/admin/user-badges/', data),
  removeUserBadge: (id: number) => legacyFetch('delete', `/community/admin/user-badges/${id}/`),
  
  getSolutions: () => legacyFetch('get', '/community/admin/solutions/'),
  deleteSolution: (id: number) => legacyFetch('delete', `/community/admin/solutions/${id}/`),
  
  getComments: () => legacyFetch('get', '/community/admin/comments/'),
  deleteComment: (id: number) => legacyFetch('delete', `/community/admin/comments/${id}/`),

  getActivities: () => legacyFetch('get', '/community/admin/activities/'),
  getNotifications: () => legacyFetch('get', '/community/admin/notifications/'),
  createNotification: (data: any) => legacyFetch('post', '/community/admin/notifications/', data),
  deleteNotification: (id: number) => legacyFetch('delete', `/community/admin/notifications/${id}/`),
};

export const miscApi = {
  submitContactForm: (data: any) => legacyFetch('post', '/contact/submit/', data),
  getDashboardStats: () => legacyFetch('get', '/exams/dashboard_stats/'),
};

export const jobsAdminApi = {
  getJobs: () => legacyFetch('get', '/jobs/admin/jobs/'),
  getJob: (id: string) => legacyFetch('get', `/jobs/admin/jobs/${id}/`),
  cancelJob: (id: string) => legacyFetch('delete', `/jobs/admin/jobs/${id}/`),
};

export const resourceHubApi = {
  markDone: (slug: string) => legacyFetch('post', `/resource-hub/${slug}/mark-done/`),
  bookmark: (slug: string) => legacyFetch('post', `/resource-hub/${slug}/bookmark/`),
};