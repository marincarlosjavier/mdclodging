import { body, param, query } from 'express-validator';
import { handleValidationErrors } from './auth.validators.js';

/**
 * Validation rules for creating a reservation
 */
export const validateCreateReservation = [
  body('property_id')
    .isInt({ min: 1 })
    .withMessage('Property ID must be a positive integer'),

  body('check_in_date')
    .isISO8601()
    .withMessage('Check-in date must be a valid date (ISO 8601 format)'),

  body('check_out_date')
    .isISO8601()
    .withMessage('Check-out date must be a valid date (ISO 8601 format)')
    .custom((value, { req }) => {
      const checkOut = new Date(value);
      const checkIn = new Date(req.body.check_in_date);
      if (checkOut <= checkIn) {
        throw new Error('Check-out date must be after check-in date');
      }
      return true;
    }),

  body('checkin_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Check-in time must be in HH:MM format'),

  body('checkout_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Check-out time must be in HH:MM format'),

  body('adults')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Adults must be between 0 and 100'),

  body('children')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Children must be between 0 and 100'),

  body('infants')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Infants must be between 0 and 100'),

  body('has_breakfast')
    .optional()
    .isBoolean()
    .withMessage('Has breakfast must be true or false'),

  body('reference')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Reference must not exceed 255 characters'),

  body('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled'])
    .withMessage('Status must be one of: active, completed, cancelled'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),

  body('additional_requirements')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Additional requirements must not exceed 1000 characters'),

  handleValidationErrors
];

/**
 * Validation rules for updating a reservation
 */
export const validateUpdateReservation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Reservation ID must be a positive integer'),

  body('property_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Property ID must be a positive integer'),

  body('guest_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Guest name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s\-\.]+$/)
    .withMessage('Guest name can only contain letters, spaces, hyphens, and periods'),

  body('guest_email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Guest email must be a valid email address')
    .normalizeEmail(),

  body('guest_phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('Phone number can only contain digits, spaces, +, -, (, )'),

  body('check_in_date')
    .optional()
    .isISO8601()
    .withMessage('Check-in date must be a valid date'),

  body('check_out_date')
    .optional()
    .isISO8601()
    .withMessage('Check-out date must be a valid date')
    .custom((value, { req }) => {
      if (req.body.check_in_date && value) {
        const checkOut = new Date(value);
        const checkIn = new Date(req.body.check_in_date);
        if (checkOut <= checkIn) {
          throw new Error('Check-out date must be after check-in date');
        }
      }
      return true;
    }),

  body('number_of_guests')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Number of guests must be between 1 and 100'),

  body('total_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total price must be a positive number'),

  body('status')
    .optional()
    .isIn(['confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out'])
    .withMessage('Status must be one of: confirmed, pending, cancelled, checked_in, checked_out'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),

  handleValidationErrors
];

/**
 * Validation rules for check-in
 */
export const validateCheckIn = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Reservation ID must be a positive integer'),

  body('actual_check_in_time')
    .optional()
    .isISO8601()
    .withMessage('Check-in time must be a valid date'),

  handleValidationErrors
];

/**
 * Validation rules for check-out
 */
export const validateCheckOut = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Reservation ID must be a positive integer'),

  body('actual_check_out_time')
    .optional()
    .isISO8601()
    .withMessage('Check-out time must be a valid date'),

  handleValidationErrors
];

/**
 * Validation rules for reservation query parameters
 */
export const validateReservationQuery = [
  query('property_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Property ID must be a positive integer'),

  query('status')
    .optional()
    .isIn(['confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out'])
    .withMessage('Status must be one of: confirmed, pending, cancelled, checked_in, checked_out'),

  query('from_date')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid date'),

  query('to_date')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid date'),

  handleValidationErrors
];

/**
 * Validation rules for reservation ID parameter
 */
export const validateReservationId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Reservation ID must be a positive integer'),

  handleValidationErrors
];
