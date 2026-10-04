import { API_BASE_URL, apiFetch, handleResponse, toSearchParams } from './http';

// User API functions
export const getUsers = async (params = {}) => {
  const searchParams = toSearchParams(params);
  const response = await apiFetch(`${API_BASE_URL}/users?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getUser = async (id) => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const searchUsers = async (query) => {
  const response = await apiFetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const updateUserStatus = async (id, isActive) => {
  const response = await apiFetch(`${API_BASE_URL}/users/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ isActive }),
  });
  return handleResponse(response);
};

// Update user profile (self or admin)
export const updateUserProfile = async (userId, profileData) => {
  const response = await apiFetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(profileData),
  });
  return handleResponse(response);
};
