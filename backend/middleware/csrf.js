import crypto from 'crypto';

// Double-submit CSRF protection.
//
// Every visitor gets a random token in an HTTP-only `csrfToken` cookie. The
// frontend reads the same token from GET /api/csrf-token (a cross-site page
// cannot read that response because of CORS) and echoes it back in the
// X-CSRF-Token header on every state-changing request. A forged cross-site
// request carries the cookie but cannot know the header value.

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfCookieOptions = () => {
  const sameSite = process.env.COOKIE_SAME_SITE || 'strict';
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/'
  };
};

// Constant-time comparison so the token cannot be guessed byte by byte
const csrfTokensEqual = (cookieToken, headerToken) => {
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const csrfProtection = (req, res, next) => {
  let token = req.cookies.csrfToken;
  if (typeof token !== 'string' || token.length !== 64) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  }
  res.locals.csrfToken = token;

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!csrfTokensEqual(req.cookies.csrfToken, req.get(CSRF_HEADER))) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token', code: 'CSRF_INVALID' });
  }

  next();
};

// @desc Get the CSRF token for this browser session
// @route GET /api/csrf-token
// @access Public
export const getCsrfToken = (req, res) => {
  res.json({ data: { csrfToken: res.locals.csrfToken } });
};
