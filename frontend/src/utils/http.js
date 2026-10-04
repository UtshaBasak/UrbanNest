// Base URL for API requests. In development the Vite proxy forwards /api to
// the backend; in production set VITE_API_URL to the deployed API URL.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

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
