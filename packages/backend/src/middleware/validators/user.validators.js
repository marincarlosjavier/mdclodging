import { body, param, validationResult } from 'express-validator';
import { handleValidationErrors } from './auth.validators.js';

/**
 * Validation rules for creating a user
 */
export const validateCreateUser = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('El correo electrónico debe ser válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('El correo no debe exceder 255 caracteres'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{8,}$/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),

  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('El nombre completo es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.]+$/)
    .withMessage('El nombre solo puede contener letras, espacios, guiones y puntos'),

  body('role')
    .isString()
    .withMessage('El rol debe ser un texto')
    .isIn(['admin', 'supervisor', 'housekeeping', 'maintenance'])
    .withMessage('El rol debe ser: admin, supervisor, housekeeping o maintenance'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('El teléfono solo puede contener dígitos, espacios, +, -, (, )')
    .isLength({ max: 20 })
    .withMessage('El teléfono no debe exceder 20 caracteres'),

  handleValidationErrors
];

/**
 * Validation rules for updating a user
 */
export const validateUpdateUser = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de usuario debe ser un número positivo'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('El correo electrónico debe ser válido')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('El correo no debe exceder 255 caracteres'),

  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.]+$/)
    .withMessage('El nombre solo puede contener letras, espacios, guiones y puntos'),

  body('role')
    .optional()
    .isIn(['admin', 'supervisor', 'cleaner'])
    .withMessage('El rol debe ser: admin, supervisor o cleaner'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]+$/)
    .withMessage('El teléfono solo puede contener dígitos, espacios, +, -, (, )')
    .isLength({ max: 20 })
    .withMessage('El teléfono no debe exceder 20 caracteres'),

  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),

  handleValidationErrors
];

/**
 * Validation rules for password change
 */
export const validatePasswordChange = [
  body('current_password')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),

  body('new_password')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{8,}$/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial')
    .custom((value, { req }) => {
      if (value === req.body.current_password) {
        throw new Error('La nueva contraseña debe ser diferente de la actual');
      }
      return true;
    }),

  body('confirm_password')
    .notEmpty()
    .withMessage('La confirmación de contraseña es requerida')
    .custom((value, { req }) => {
      if (value !== req.body.new_password) {
        throw new Error('La confirmación de contraseña no coincide');
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
    .withMessage('El ID de usuario debe ser un número positivo'),

  handleValidationErrors
];
