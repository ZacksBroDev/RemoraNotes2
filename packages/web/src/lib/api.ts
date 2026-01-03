import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
// Note: Don't auto-redirect on 401 - let the AuthContext handle it
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Just reject the error, let components handle auth state
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getGoogleAuthUrl: (scopes?: string[]) => {
    const params = new URLSearchParams();
    if (scopes?.length) params.set('scopes', scopes.join(','));
    return `/api/v1/auth/google?${params.toString()}`;
  },
};

// Contacts API
export const contactsApi = {
  list: (params?: Record<string, unknown>) => api.get('/contacts', { params }),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/contacts', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  archive: (id: string) => api.post(`/contacts/${id}/archive`),
  unarchive: (id: string) => api.post(`/contacts/${id}/unarchive`),
};

// Interactions API
export const interactionsApi = {
  list: (params?: Record<string, unknown>) => api.get('/interactions', { params }),
  get: (id: string) => api.get(`/interactions/${id}`),
  create: (data: Record<string, unknown>) => api.post('/interactions', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/interactions/${id}`, data),
  delete: (id: string) => api.delete(`/interactions/${id}`),
};

// Reminders API
export const remindersApi = {
  getTodayQueue: () => api.get('/reminders/today'),
  listRules: (params?: Record<string, unknown>) => api.get('/reminders/rules', { params }),
  getRule: (id: string) => api.get(`/reminders/rules/${id}`),
  createRule: (data: Record<string, unknown>) => api.post('/reminders/rules', data),
  updateRule: (id: string, data: Record<string, unknown>) =>
    api.patch(`/reminders/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/reminders/rules/${id}`),
  markDone: (id: string, data?: Record<string, unknown>) => api.post(`/reminders/${id}/done`, data),
  snooze: (id: string, data: { until: string }) => api.post(`/reminders/${id}/snooze`, data),
  skip: (id: string) => api.post(`/reminders/${id}/skip`),
};

// Calendar API
export const calendarApi = {
  sync: () => api.post('/calendar/sync'),
  listEvents: (params?: Record<string, unknown>) => api.get('/calendar/events', { params }),
  linkToContact: (eventId: string, contactId: string) =>
    api.post(`/calendar/events/${eventId}/link`, { contactId }),
};

// Users API
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updatePreferences: (data: Record<string, unknown>) => api.patch('/users/me/preferences', data),
  updateMode: (mode: string) => api.patch('/users/me/mode', { mode }),
  deleteAccount: () => api.delete('/users/me'),
};
