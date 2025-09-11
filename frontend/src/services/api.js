import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response, // Return the full response object
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      // Let app routing handle navigation to login
    }
    
    // Return error response
    return Promise.reject({
      message: error.response?.data?.message || 'An error occurred',
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

// Auth API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// Projects API
export const projectsApi = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (projectData) => api.post('/projects', projectData),
  update: (id, updates) => api.put(`/projects/${id}`, updates),
  delete: (id) => api.delete(`/projects/${id}`),
  addCollaborator: (projectId, userId, role = 'editor') => 
    api.post(`/projects/${projectId}/collaborators/`, { userId, role }),
  removeCollaborator: (projectId, userId) => 
    api.delete(`/projects/${projectId}/collaborators/${userId}/`),
};

// Code Execution API
export const executionApi = {
  parseCode: (code) => api.post('/parse', { code }),
  executeCode: async (code, projectId) => {
    try {
      const response = await api.post('/execute', { 
        code, 
        projectId: projectId || undefined 
      });
      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  testEndpoint: (endpointData) => api.post('/test-endpoint', endpointData),
  saveEndpoints: (projectId, endpoints) => 
    api.post(`/projects/${projectId}/endpoints`, { endpoints }),
};

// Users API
export const usersApi = {
  updateProfile: (userId, updates) => api.put(`/users/${userId}`, updates),
  getProfile: (userId) => api.get(`/users/${userId}`),
};

export default api;
