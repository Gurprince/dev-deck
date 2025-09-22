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
  // Add a collaborator by email
  addCollaborator: async (projectId, { email, role = 'editor' }) => {
    try {
      const response = await api.post(`/projects/${projectId}/collaborators`, { 
        email: email.toLowerCase().trim(), 
        role 
      });
      console.log('API Response:', response);
      return response;
    } catch (error) {
      console.error('Error in addCollaborator:', error);
      throw error;
    }
  },
  // Search for users by email or name
  searchUsers: (query) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  removeCollaborator: (projectId, userId) => 
    api.delete(`/projects/${projectId}/collaborators/${userId}`),
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

// Invitations API
export const invitationsApi = {
  getMyInvitations: () => api.get('/projects/invitations/me'),
  respondToInvitation: (projectId, invitationId, action) => 
    api.post(`/projects/${projectId}/invitations/${invitationId}/${action}`)
};

// Users API
export const usersApi = {
  updateProfile: (userId, updates) => api.put(`/users/${userId}`, updates),
  getProfile: (userId) => api.get(`/users/${userId}`),
  search: (q) => api.get(`/users/search`, { params: { q } }),
};

export default api;
