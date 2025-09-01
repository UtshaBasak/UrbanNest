const API_BASE_URL = '/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `${response.status} ${response.statusText}` }));
    throw new Error(error.message || `${response.status} ${response.statusText}`);
  }
  return response.json();
};

// Top-rated properties
export const getTopRatedProperties = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  const response = await fetch(`${API_BASE_URL}/properties/top-rated?${searchParams}`);
  return handleResponse(response);
};

// Auth API functions
export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
};

export const createMonthlyPayment = async ({ bookingId, month, year, monthName, amount, totalExpected, paymentMethod = 'credit_card' }) => {
  const response = await fetch(`${API_BASE_URL}/transactions/monthly-pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ bookingId, month, year, monthName, amount, totalExpected, paymentMethod }),
  });
  return handleResponse(response);
};

export const deleteTransaction = async (id) => {
  const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getTransactionsByProperty = async (propertyId) => {
  const response = await fetch(`${API_BASE_URL}/transactions/property/${propertyId}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(userData),
  });
  return handleResponse(response);
};

export const logout = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const updateProfile = async (profileData) => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(profileData),
  });
  return handleResponse(response);
};

// Property API functions
export const getProperties = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/properties?${searchParams}`);
  return handleResponse(response);
};

export const searchProperties = async (params = {}) => {
  return getProperties(params);
};

export const getProperty = async (id) => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`);
  return handleResponse(response);
};

export const createProperty = async (propertyData) => {
  const response = await fetch(`${API_BASE_URL}/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(propertyData),
  });
  return handleResponse(response);
};

export const updateProperty = async (id, propertyData) => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(propertyData),
  });
  return handleResponse(response);
};

export const deleteProperty = async (id) => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getPropertiesByOwner = async (ownerId, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/properties/owner/${ownerId}?${searchParams}`);
  return handleResponse(response);
};

// Booking API functions
export const createBooking = async (bookingData) => {
  const response = await fetch(`${API_BASE_URL}/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(bookingData),
  });
  return handleResponse(response);
};

export const getMyBookings = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/bookings/my?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const updateBookingStatus = async (id, status, rejectionReason = '') => {
  const response = await fetch(`${API_BASE_URL}/bookings/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status, rejectionReason }),
  });
  return handleResponse(response);
};

export const cancelBooking = async (id) => {
  const response = await fetch(`${API_BASE_URL}/bookings/${id}/cancel`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse(response);
};

// Review API functions
export const createReview = async (reviewData) => {
  const response = await fetch(`${API_BASE_URL}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(reviewData),
  });
  return handleResponse(response);
};

export const getPropertyReviews = async (propertyId, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/reviews/property/${propertyId}?${searchParams}`);
  return handleResponse(response);
};

export const getMyReviews = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/reviews/my?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

// User API functions
export const getUser = async (id) => {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

// Favourites API (tenant)
export const getMyFavourites = async () => {
  const response = await fetch(`${API_BASE_URL}/users/me/favourites`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const addFavourite = async ({ itemId, itemType }) => {
  const response = await fetch(`${API_BASE_URL}/users/me/favourites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ itemId, itemType }),
  });
  return handleResponse(response);
};

export const removeFavourite = async ({ itemType, itemId }) => {
  const response = await fetch(`${API_BASE_URL}/users/me/favourites/${itemType}/${itemId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const getUsers = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/users?${searchParams}`);
  return handleResponse(response);
};

// Transaction API functions
export const getMyTransactions = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  
  const response = await fetch(`${API_BASE_URL}/transactions/my?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const processPayment = async (transactionId, paymentMethod = 'credit_card', desiredStatus) => {
  const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/pay`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ paymentMethod, desiredStatus }),
  });
  return handleResponse(response);
};

// Auth deletion
export const deleteCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

// Notification API functions
export const getMyNotifications = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  const response = await fetch(`${API_BASE_URL}/notifications/my?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markNotificationRead = async (id) => {
  const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markNotificationUnread = async (id) => {
  const response = await fetch(`${API_BASE_URL}/notifications/${id}/unread`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markAllNotificationsRead = async () => {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const markAllNotificationsUnread = async () => {
  const response = await fetch(`${API_BASE_URL}/notifications/unread-all`, {
    method: 'PUT',
    credentials: 'include',
  });
  return handleResponse(response);
};

// Delete booking
export const deleteBooking = async (id) => {
  const response = await fetch(`${API_BASE_URL}/bookings/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

// Delete rating
export const deleteRating = async (id) => {
  const response = await fetch(`${API_BASE_URL}/ratings/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

export const deleteNotification = async (id) => {
  const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse(response);
};

// Rating API functions
export const createUserRating = async ({ rateeId, rating, comment = '', context }) => {
  const response = await fetch(`${API_BASE_URL}/ratings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ rateeId, rating, comment, context }),
  });
  return handleResponse(response);
};

export const getUserRatingSummary = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/ratings/${userId}/summary`);
  return handleResponse(response);
};

export const listUserRatings = async (userId, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  const response = await fetch(`${API_BASE_URL}/ratings/${userId}?${searchParams}`);
  return handleResponse(response);
};

// Eligibility helpers
export const canRateUser = async (rateeId, context) => {
  const searchParams = new URLSearchParams();
  if (rateeId) searchParams.append('rateeId', rateeId);
  if (context) searchParams.append('context', context);
  const response = await fetch(`${API_BASE_URL}/ratings/can-rate/check?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const canReviewProperty = async (propertyId) => {
  const searchParams = new URLSearchParams();
  if (propertyId) searchParams.append('propertyId', propertyId);
  const response = await fetch(`${API_BASE_URL}/reviews/can-review/check?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const canViewTenantContact = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/can-view-contact`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

// Leave Request API functions
export const createLeaveRequest = async ({ bookingId, message }) => {
  const response = await fetch(`${API_BASE_URL}/leave-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ bookingId, message }),
  });
  return handleResponse(response);
};

export const listMyLeaveRequests = async (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== '') {
      searchParams.append(key, params[key]);
    }
  });
  const response = await fetch(`${API_BASE_URL}/leave-requests/my?${searchParams}`, {
    credentials: 'include',
  });
  return handleResponse(response);
};

export const decideLeaveRequest = async (id, { decision, condition, note }) => {
  const response = await fetch(`${API_BASE_URL}/leave-requests/${id}/decision`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ decision, condition, note }),
  });
  return handleResponse(response);
};