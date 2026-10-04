import mongoose from 'mongoose';

// Escape user input before using it inside a MongoDB $regex.
// Non-string values (e.g. ?search=a&search=b arrays) are rejected by returning null.
export const toSearchRegex = (value, maxLength = 100) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, maxLength);
  if (!trimmed) return null;
  return { $regex: trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
};

// Match a request value against a fixed list and return the list's own entry,
// so query filters never contain raw user input. Returns undefined on no match.
export const pickAllowed = (value, allowed) => allowed.find((option) => option === value);

// Strip spaces, dashes and brackets so "+880 1712-345678" matches the User model's phone format
export const normalizePhone = (value) => (typeof value === 'string' ? value.replace(/[\s\-()]/g, '') : value);
export const PHONE_PATTERN = /^\+?\d{6,16}$/;

// Parse page/limit query params into safe, bounded integers.
export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const buildPagination = (total, page, limit) => ({
  total,
  page,
  pages: Math.ceil(total / limit),
  limit
});

// router.param() handler: reject malformed ObjectIds with 400 instead of a CastError 500.
export const validateObjectIdParam = (req, res, next, value, name) => {
  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({ message: `Invalid ${name}` });
  }
  next();
};

export const registerObjectIdParams = (router, names) => {
  names.forEach((name) => router.param(name, validateObjectIdParam));
};

// Map well-known Mongoose/MongoDB errors to client errors. Returns true when handled.
export const handleKnownDbError = (res, error) => {
  if (error?.name === 'ValidationError') {
    const message = Object.values(error.errors || {})[0]?.message || error.message;
    res.status(400).json({ message });
    return true;
  }
  if (error?.name === 'CastError') {
    res.status(400).json({ message: `Invalid ${error.path || 'value'}` });
    return true;
  }
  if (error?.code === 11000) {
    res.status(409).json({ message: 'A record with these details already exists' });
    return true;
  }
  return false;
};
