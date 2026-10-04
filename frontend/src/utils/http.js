// Base URL for API requests. In development the Vite proxy forwards /api to
// the backend; in production set VITE_API_URL to the deployed API URL.
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// Parse a fetch response, throwing an Error with the server's message on failure
export const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `${response.status} ${response.statusText}` }));
    throw new Error(error.message || `${response.status} ${response.statusText}`);
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
