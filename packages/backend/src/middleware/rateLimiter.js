import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login, register)
 * Stricter limits to prevent brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Demasiados intentos de inicio de sesión. Por favor, intente más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  validate: { trustProxy: false }, // Disable validation since we configure trust proxy at app level
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión',
      message: 'Ha excedido el límite de intentos. Por favor, espere 15 minutos antes de intentar nuevamente.',
      retryAfter: 900 // seconds
    });
  }
});

/**
 * General API rate limiter
 * Applied to all API routes to prevent abuse
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More permissive in development
  message: {
    error: 'Demasiadas solicitudes',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Disable validation since we configure trust proxy at app level
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiadas solicitudes',
      message: 'Ha excedido el límite de solicitudes. Por favor, espere unos minutos.',
      retryAfter: 900
    });
  }
});

/**
 * Strict rate limiter for sensitive operations
 * Used for password reset, email verification, etc.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    error: 'Demasiados intentos',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Disable validation since we configure trust proxy at app level
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos',
      message: 'Ha excedido el límite de intentos para esta operación. Por favor, espere una hora.',
      retryAfter: 3600
    });
  }
});

/**
 * Lenient rate limiter for public endpoints
 * Used for health checks, public data, etc.
 */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false } // Disable validation since we configure trust proxy at app level
});
