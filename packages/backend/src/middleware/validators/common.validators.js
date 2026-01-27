import { param, query } from 'express-validator';
import { handleValidationErrors } from './auth.validators.js';

/**
 * Validation for integer ID parameter
 */
export const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),

  handleValidationErrors
];

/**
 * Validation for pagination parameters
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors
];

/**
 * Validation for date range query parameters
 */
export const validateDateRange = [
  query('from_date')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid date (ISO 8601 format)'),

  query('to_date')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid date (ISO 8601 format)')
    .custom((value, { req }) => {
      if (req.query.from_date && value) {
        const fromDate = new Date(req.query.from_date);
        const toDate = new Date(value);
        if (toDate < fromDate) {
          throw new Error('To date must be after from date');
        }
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation for search query
 */
export const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-\.@]+$/)
    .withMessage('Search query contains invalid characters'),

  handleValidationErrors
];

/**
 * Sanitize and validate text input
 */
export const sanitizeText = (value) => {
  if (typeof value !== 'string') return value;

  // Remove any potential XSS vectors
  return value
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Check if string contains SQL injection patterns
 */
export const hasSQLInjection = (value) => {
  if (typeof value !== 'string') return false;

  const sqlPatterns = [
    /(\bunion\b.*\bselect\b)/i,
    /(\bselect\b.*\bfrom\b)/i,
    /(\binsert\b.*\binto\b)/i,
    /(\bdelete\b.*\bfrom\b)/i,
    /(\bdrop\b.*\btable\b)/i,
    /(\bupdate\b.*\bset\b)/i,
    /(;|\-\-|\/\*|\*\/)/,
    /(\bexec\b|\bexecute\b)/i
  ];

  return sqlPatterns.some(pattern => pattern.test(value));
};
