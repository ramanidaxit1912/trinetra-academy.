import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const isSessionTerminated = err.response?.data?.code === 'SESSION_TERMINATED';
      const errMsg = err.response?.data?.error || '⚠️ તમારું એકાઉન્ટ અન્ય ડિવાઇસમાં લોગિન થયું છે.';
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');

      if (isSessionTerminated) {
        sessionStorage.setItem('session_terminated_msg', errMsg);
        window.dispatchEvent(new CustomEvent('session-terminated', { detail: errMsg }));
      }
      
      if (window.location.pathname.startsWith('/exam') || window.location.pathname.startsWith('/student')) {
        setTimeout(() => {
          if (!window.location.pathname.includes('/student')) {
            window.location.href = '/student';
          }
        }, 100);
      }
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────
export const sendOTP        = (mobile, name)          => api.post('/auth/send-otp', { mobile, name });
export const verifyOTP      = (mobile, name, otp)     => api.post('/auth/verify-otp', { mobile, name, otp });
export const checkSession   = ()                      => api.get('/auth/check-session');
export const teacherRequestOTP = (username, password, masterPin) => api.post('/auth/teacher-request-otp', { username, password, masterPin });
export const teacherVerifyOTP  = (username, otp) => api.post('/auth/teacher-verify-otp', { username, otp });

// ─── Questions ────────────────────────────────────────────────
export const getQuestions     = ()      => api.get('/questions');
export const getAllQuestions   = ()      => api.get('/questions/all');
export const getQuestionsByTest = (code) => api.get(`/questions/test/${code}`);
export const addQuestion      = (data)  => api.post('/questions', data);
export const createQuestion   = (data)  => api.post('/questions', data);
export const updateQuestion   = (id, d) => api.put(`/questions/${id}`, d);
export const deleteQuestion   = (id)    => api.delete(`/questions/${id}`);
export const updateTestMeta   = (code, data) => api.put(`/questions/test/${code}/meta`, data);
export const activateTest     = (payload) => api.post('/questions/activate-test', typeof payload === 'object' ? payload : { testCode: payload });
export const scheduleTest     = (payload, scheduledAt) => api.post('/questions/schedule-test', typeof payload === 'object' ? payload : { testCode: payload, scheduledAt });

// ─── Submissions ──────────────────────────────────────────────
export const submitTest       = (data)  => api.post('/submissions', data);
export const saveTestProgress = (data)  => api.post('/submissions/save-progress', data);
export const getActiveTestSession = (params) => api.get('/submissions/active-session', { params });
export const discardActiveTestSession = (data) => api.delete('/submissions/active-session', { data });
export const getMySubmissions = ()      => api.get('/submissions/my');
export const getStudentHistoryByMobile = (m) => api.get(`/submissions/by-mobile/${m}`);
export const getSubmissionReview = (id) => api.get(`/submissions/review/${id}`);
export const getAllSubmissions = ()      => api.get('/submissions');
export const getLeaderboard   = ()      => api.get('/submissions/leaderboard');
export const getTestWiseLeaderboard = () => api.get('/submissions/leaderboard/by-test');

export const gradeSubmission  = (id, d) => api.put(`/submissions/${id}/grade`, d);
export const reEvaluateSubmissions = (data) => api.post('/submissions/re-evaluate', data);
export const sendWhatsAppScorecard = (id, data = {}) => api.post(`/submissions/${id}/send-whatsapp`, data);

// ─── Upload ───────────────────────────────────────────────────
export const uploadPhoto = (formData) =>
  api.post('/upload/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

// ─── Teacher ──────────────────────────────────────────────────
export const getTeacherStats        = ()   => api.get('/teacher/stats');
export const getStudents            = ()   => api.get('/teacher/students');
export const resetStudentSession    = (id) => api.post(`/teacher/student/${id}/reset-session`);
export const deleteStudent          = (id) => api.delete(`/teacher/student/${id}`);
export const grantMasterAccess      = (id, data) => api.post(`/teacher/student/${id}/grant-master-access`, data);
export const grantMasterByMobile    = (data) => api.post('/teacher/grant-master-by-mobile', data);
export const getLiveOTPs            = ()   => api.get('/teacher/live-otps');
export const getWhatsAppBridgeStatus = ()  => api.get('/whatsapp/status');
export const disconnectWhatsAppBridge = () => api.post('/whatsapp/disconnect');
export const broadcastWhatsApp      = (data) => api.post('/teacher/broadcast-whatsapp', data);
export const exportCSV              = ()   => window.open('/api/teacher/export-csv', '_blank');
export const cleanTestData          = (data) => api.post('/teacher/clean-test-data', data);

// ─── Materials ────────────────────────────────────────────────
export const getMaterials    = (params) => api.get('/materials', { params });
export const createMaterial  = (formDataOrData) => {
  const isFormData = formDataOrData instanceof FormData;
  return api.post('/materials', formDataOrData, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
};
export const updateMaterial  = (id, formDataOrData) => {
  const isFormData = formDataOrData instanceof FormData;
  return api.put(`/materials/${id}`, formDataOrData, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
};
export const deleteMaterial  = (id) => api.delete(`/materials/${id}`);

// ─── Marketing & Offers ───────────────────────────────────────
export const getMarketingItems   = (params) => api.get('/marketing', { params });
export const createMarketingItem = (formDataOrData) => {
  const isFormData = formDataOrData instanceof FormData;
  return api.post('/marketing', formDataOrData, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
};
export const updateMarketingItem = (id, formDataOrData) => {
  const isFormData = formDataOrData instanceof FormData;
  return api.put(`/marketing/${id}`, formDataOrData, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
};
export const deleteMarketingItem = (id) => api.delete(`/marketing/${id}`);

export default api;


