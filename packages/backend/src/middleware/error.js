// Global error handler
export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error
  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  // Validation errors
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  }

  // Database errors
  if (err.code === '23505') { // Unique violation
    status = 409;
    message = 'Resource already exists';
  }

  if (err.code === '23503') { // Foreign key violation
    status = 400;
    message = 'Invalid reference';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

// 404 handler
export function notFound(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
}

// Async error wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
