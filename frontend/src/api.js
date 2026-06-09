const API_BASE = 'http://localhost:8000/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Request failure on ${path}:`, error);
    throw error;
  }
}

export const api = {
  // Tasks
  tasks: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.project_id) params.append('project_id', filters.project_id);
      if (filters.search) params.append('search', filters.search);
      
      const query = params.toString();
      return request(`/tasks${query ? `?${query}` : ''}`, { method: 'GET' });
    },
    get: (id) => request(`/tasks/${id}`, { method: 'GET' }),
    create: (data) => request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },

  // Daily Tasks (calendar schedule blocks)
  dailyTasks: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.task_id) params.append('task_id', filters.task_id);
      const query = params.toString();
      return request(`/daily-tasks${query ? `?${query}` : ''}`, { method: 'GET' });
    },
    create: (data) => request('/daily-tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/daily-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/daily-tasks/${id}`, { method: 'DELETE' }),
  },

  // Projects
  projects: {
    list: () => request('/projects', { method: 'GET' }),
    create: (data) => request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Settings
  settings: {
    get: () => request('/settings', { method: 'GET' }),
    update: (data) => request('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    syncPlanning: () => request('/settings/sync-planning', { method: 'POST' }),
  },

  // AI Integration
  ai: {
    classify: (data) => request('/ai/classify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    weeklyPlan: () => request('/ai/weekly-plan', { method: 'POST' }),
    flowAnalyzer: () => request('/ai/flow-analyzer', { method: 'POST' }),
    enhanceTicket: (data) => request('/ai/enhance-ticket', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },
  
  // Views
  views: {
    list: () => request('/views', { method: 'GET' }),
    get: (id) => request(`/views/${id}`, { method: 'GET' }),
    create: (data) => request('/views', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updateConfig: (id, data) => request(`/views/${id}/update-config`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/views/${id}`, { method: 'DELETE' }),
    execute: (id) => request(`/views/${id}/execute`, { method: 'POST' }),
  },
};
export default api;
