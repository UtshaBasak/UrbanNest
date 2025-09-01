const API_BASE_URL = '/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || 'An error occurred');
  }
  return response.json();
};

// User API functions
export const getUsers = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/users?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getUser = async (id) => {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const searchUsers = async (query) => {
  const response = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const updateUserStatus = async (id, isActive) => {
  const response = await fetch(`${API_BASE_URL}/users/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });
  return handleResponse(response);
};