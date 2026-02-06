import { body, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

/**
 * Validation rules for login
 */
export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Password must be between 1 and 255 characters'),

  body('subdomain')
    .optional({ values: 'falsy' })
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 50 })
    .withMessage('Subdomain must be between 3 and 50 characters'),

  handleValidationErrors
];

/**
 * Validation rules for tenant registration
 */
export const validateRegisterTenant = [
  body('tenant_name')
    .trim()
    .notEmpty()
    .withMessage('Tenant name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tenant name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-\.]+$/)
    .withMessage('Tenant name can only contain letters, numbers, spaces, hyphens, and periods'),

  body('subdomain')
    .trim()
    .notEmpty()
    .withMessage('Subdomain is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens')
    .isLength({ min: 3, max: 50 })
    .withMessage('Subdomain must be between 3 and 50 characters')
    .custom(value => {
      const reserved = ['admin', 'api', 'www', 'mail', 'smtp', 'ftp', 'test', 'dev', 'staging', 'prod'];
      if (reserved.includes(value.toLowerCase())) {
        throw new Error('This subdomain is reserved and cannot be used');
      }
      return true;
    }),

  body('tenant_email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Tenant email must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('tenant_phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, +, -, (, )')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),

  body('admin_name')
    .trim()
    .notEmpty()
    .withMessage('Admin name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Admin name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Admin name can only contain letters, spaces, hyphens, and periods'),

  body('admin_email')
    .trim()
    .isEmail()
    .withMessage('Admin email must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Admin email must not exceed 255 characters'),

  body('admin_password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{12,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  handleValidationErrors
];

/**
 * Validation rules for token refresh
 */
export const validateRefreshToken = [
  body('token')
    .notEmpty()
    .withMessage('Token is required')
    .isJWT()
    .withMessage('Token must be a valid JWT'),

  handleValidationErrors
];
