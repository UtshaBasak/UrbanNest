// Base URL for API requests. In development the Vite proxy forwards /api to
// the backend; in production set VITE_API_URL to the deployed API URL.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
let csrfTokenPromise = null;

// Fetch (once) the CSRF token the API expects in the X-CSRF-Token header
const getCsrfToken = (refresh = false) => {
  if (refresh || !csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE_URL}/csrf-token`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Could not get CSRF token'))))
      .then((body) => body.data.csrfToken)
      .catch((err) => {
        csrfTokenPromise = null;
        throw err;
      });
  }
  return csrfTokenPromise;
};

// fetch wrapper for API calls: always sends cookies and adds the CSRF token to
// state-changing requests, retrying once with a fresh token if it was rejected
export const apiFetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const send = async (refreshToken) => {
    const headers = { ...options.headers };
    if (!SAFE_METHODS.includes(method)) {
      headers['X-CSRF-Token'] = await getCsrfToken(refreshToken);
    }
    return fetch(url, { ...options, method, headers, credentials: 'include' });
  };

  const response = await send(false);
  if (response.status === 403 && !SAFE_METHODS.includes(method)) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.code === 'CSRF_INVALID') {
      return send(true);
    }
  }
  return response;
};

// Parse a fetch response, throwing an Error with the server's message on failure
export const handleResponse = async (response) => {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: `${response.status} ${response.statusText}` }));
    const err = new Error(body.message || `${response.status} ${response.statusText}`);
    // Field-level validation errors ({ path, msg }) and HTTP status for callers
    err.errors = body.errors;
    err.status = response.status;
    throw err;
  }
  return response.json();
};

// Build query parameters, skipping undefined and empty values
export const toSearchParams = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.append(key, value);
    }
  });
  return searchParams;
};
