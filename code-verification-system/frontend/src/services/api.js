import axios from 'axios';

// Same-origin in dev (Vite proxy). Set VITE_API_URL for a separately hosted API.
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  withCredentials: true,
  timeout: 15000,
});

// Turns any failure into a short, friendly sentence; raw server/network errors never reach the UI.
export function friendlyError(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (err?.response?.data?.message && err.response.status < 500) return err.response.data.message;
  if (err?.code === 'ECONNABORTED' || err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

export const verifyCode = (code) =>
  api.post('/codes/verify', { code }, { validateStatus: (s) => s < 500 }); // 404/409/429 carry a usable body

export const login = (email, password) => api.post('/auth/login', { email, password });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

export const getStats = () => api.get('/admin/stats');
export const getCodes = (params) => api.get('/admin/codes', { params });
export const addCode = (payload) => api.post('/admin/codes', payload);
export const generateCodes = (payload) => api.post('/admin/codes/generate', payload);
export const deleteCode = (id) => api.delete(`/admin/codes/${id}`);
export const getBatches = () => api.get('/admin/batches');
export const exportCodes = (params) => api.get('/admin/codes/export', { params, responseType: 'blob' });

export default api;
