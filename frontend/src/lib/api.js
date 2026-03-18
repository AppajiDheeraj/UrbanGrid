import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  getProfile: () => api.get('/auth/me/profile'),
  updateProfile: (payload) => api.patch('/auth/me/profile', payload),
  getSettings: () => api.get('/auth/me/settings'),
  updateSettings: (payload) => api.patch('/auth/me/settings', payload),
};

export const citizenAPI = {
  submitComplaint: (formData) => api.post('/citizen/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMyComplaints: () => api.get('/citizen/complaints/my'),
  getComplaint: (id) => api.get(`/citizen/complaints/${id}`),
  trackStatus: (id) => api.get(`/citizen/complaints/${id}/status`),
};

export const adminAPI = {
  getPendingComplaints: () => api.get('/admin/complaints/pending'),
  getAllComplaints: () => api.get('/admin/complaints/all'),
  verifyComplaint: (id, data) => api.patch(`/admin/complaints/${id}/verify`, data),
  rejectComplaint: (id, data) => api.patch(`/admin/complaints/${id}/reject`, data),
  getDashboardStats: () => api.get('/admin/dashboard/stats'),
};

export const ministryAPI = {
  getComplaints: () => api.get('/ministry/complaints'),
  createTender: (data) => api.post('/ministry/tenders', data),
  getTenders: () => api.get('/ministry/tenders'),
  getTender: (id) => api.get(`/ministry/tenders/${id}`),
  getBids: (tenderId) => api.get(`/ministry/tenders/${tenderId}/bids`),
  selectBid: (tenderId, bidId) => api.post(`/ministry/tenders/${tenderId}/bids/${bidId}/select`),
};

export const contractorAPI = {
  getAvailableTenders: () => api.get('/contractor/tenders/available'),
  submitBid: (tenderId, formData) => api.post(`/contractor/tenders/${tenderId}/bid`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getMyBids: () => api.get('/contractor/bids'),
  getMyProjects: () => api.get('/contractor/projects'),
  updateProgress: (projectId, formData) => api.post(`/contractor/projects/${projectId}/progress`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const approvalAPI = {
  getPending: () => api.get('/approvals/pending'),
  getHistory: () => api.get('/approvals/history'),
};

export const regionAPI = {
  getProjects: () => api.get('/region/projects'),
  getComplaints: () => api.get('/region/complaints'),
};

export default api;
