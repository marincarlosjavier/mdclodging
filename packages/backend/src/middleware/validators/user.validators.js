import { body, param, validationResult } from 'express-validator';
import { handleValidationErrors } from './auth.validators.js';

/**
 * Validation rules for creating a user
 */
export const validateCreateUser = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isLength({ min: 12 })
    .withMessage('Password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{12,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and periods'),

  body('role')
    .isIn(['admin', 'supervisor', 'cleaner'])
    .withMessage('Role must be one of: admin, supervisor, cleaner'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, +, -, (, )')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),

  handleValidationErrors
];

/**
 * Validation rules for updating a user
 */
export const validateUpdateUser = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and periods'),

  body('role')
    .optional()
    .isIn(['admin', 'supervisor', 'cleaner'])
    .withMessage('Role must be one of: admin, supervisor, cleaner'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, +, -, (, )')
    .isLength({ max: 20 })
    .withMessage('Phone number must not exceed 20 characters'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean value'),

  handleValidationErrors
];

/**
 * Validation rules for password change
 */
export const validatePasswordChange = [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),

  body('new_password')
    .isLength({ min: 12 })
    .withMessage('New password must be at least 12 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{12,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  body('confirm_password')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation rules for user ID parameter
 */
export const validateUserId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),

  handleValidationErrors
];
