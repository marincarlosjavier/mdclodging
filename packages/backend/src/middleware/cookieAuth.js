/**
 * Cookie-based authentication utilities
 * Provides secure httpOnly cookie management for JWT tokens
 */

const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Set authentication cookie with secure httpOnly settings
 * @param {Response} res - Express response object
 * @param {string} token - JWT token to store in cookie
 */
export function setAuthCookie(res, token) {
  const cookieOptions = {
    httpOnly: true, // Cannot be accessed via JavaScript (XSS protection)
    secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
    sameSite: 'strict', // CSRF protection
    maxAge: COOKIE_MAX_AGE,
    path: '/' // Available across entire domain
  };

  res.cookie(COOKIE_NAME, token, cookieOptions);
}

/**
 * Clear authentication cookie (logout)
 * @param {Response} res - Express response object
 */
export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
}

/**
 * Get token from cookie
 * @param {Request} req - Express request object
 * @returns {string|null} - JWT token or null if not found
 */
export function getTokenFromCookie(req) {
  return req.cookies?.[COOKIE_NAME] || null;
}

/**
 * Cookie configuration constants
 */
export const cookieConfig = {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  COOKIE_MAX_AGE_DAYS: 7
};
