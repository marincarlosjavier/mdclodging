/**
 * Environment variable validation
 * Ensures all required configuration is present before starting the application
 */

/**
 * Required environment variables for all environments
 */
const REQUIRED_VARS = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

/**
 * Required environment variables for production only
 */
const PRODUCTION_REQUIRED_VARS = [
  'CORS_ORIGIN'
];

/**
 * Recommended environment variables (warnings if missing)
 */
const RECOMMENDED_VARS = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SENTRY_DSN'
];

/**
 * Validate a single environment variable
 * @param {string} varName - Variable name
 * @param {Object} validations - Validation rules
 * @returns {string|null} - Error message or null if valid
 */
function validateVar(varName, validations = {}) {
  const value = process.env[varName];

  if (!value && validations.required) {
    return `${varName} is required`;
  }

  if (!value) {
    return null; // Optional and not set
  }

  // Minimum length validation
  if (validations.minLength && value.length < validations.minLength) {
    return `${varName} must be at least ${validations.minLength} characters (current: ${value.length})`;
  }

  // Pattern validation
  if (validations.pattern && !validations.pattern.test(value)) {
    return `${varName} format is invalid`;
  }

  // Enum validation
  if (validations.enum && !validations.enum.includes(value)) {
    return `${varName} must be one of: ${validations.enum.join(', ')}`;
  }

  // Numeric validation
  if (validations.numeric) {
    const num = parseInt(value);
    if (isNaN(num)) {
      return `${varName} must be a number`;
    }
    if (validations.min !== undefined && num < validations.min) {
      return `${varName} must be >= ${validations.min}`;
    }
    if (validations.max !== undefined && num > validations.max) {
      return `${varName} must be <= ${validations.max}`;
    }
  }

  return null;
}

/**
 * Validate all environment variables
 * @throws {Error} - If validation fails
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';

  console.log('\n🔍 Validating environment variables...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // Validate required variables
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      errors.push(`❌ ${varName} is required but not set`);
    }
  }

  // Validate production-specific required variables
  if (isProduction) {
    for (const varName of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[varName]) {
        errors.push(`❌ ${varName} is required in production but not set`);
      }
    }
  }

  // Specific validations
  const validationRules = {
    JWT_SECRET: {
      required: true,
      minLength: 32,
      validator: (value) => {
        if (value === 'your_super_secret_jwt_key_change_in_production_min_32_characters_long' && isProduction) {
          return 'JWT_SECRET must be changed from default value in production';
        }
        return null;
      }
    },
    DB_PORT: {
      numeric: true,
      min: 1,
      max: 65535
    },
    NODE_ENV: {
      enum: ['development', 'production', 'test'],
      validator: (value) => {
        if (!value) {
          warnings.push('⚠️  NODE_ENV not set, defaulting to development');
        }
        return null;
      }
    },
    CORS_ORIGIN: {
      validator: (value) => {
        if (isProduction && (!value || value === 'http://localhost:5173')) {
          return 'CORS_ORIGIN must be set to production domain (not localhost)';
        }
        return null;
      }
    },
    PORT: {
      numeric: true,
      min: 1,
      max: 65535
    }
  };

  // Run specific validations
  for (const [varName, rules] of Object.entries(validationRules)) {
    const error = validateVar(varName, rules);
    if (error) {
      errors.push(`❌ ${error}`);
    }

    // Run custom validator
    if (rules.validator && process.env[varName]) {
      const customError = rules.validator(process.env[varName]);
      if (customError) {
        errors.push(`❌ ${customError}`);
      }
    }
  }

  // Check recommended variables
  for (const varName of RECOMMENDED_VARS) {
    if (!process.env[varName]) {
      warnings.push(`⚠️  ${varName} is not set (recommended for full functionality)`);
    }
  }

  // Display results
  if (errors.length > 0) {
    console.error('\n❌ Environment validation failed:\n');
    errors.forEach(err => console.error(`   ${err}`));
    console.error('\n💡 Please check your .env file and ensure all required variables are set.\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment warnings:\n');
    warnings.forEach(warn => console.warn(`   ${warn}`));
    console.warn('');
  }

  // Success - display configured variables (sanitized)
  console.log('✅ Environment validation passed\n');
  console.log('📋 Configuration summary:');
  console.log(`   Database: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`   JWT Secret: ${process.env.JWT_SECRET ? '***' + process.env.JWT_SECRET.slice(-8) : 'NOT SET'}`);
  console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173 (default)'}`);
  console.log(`   Port: ${process.env.PORT || '3000 (default)'}`);

  if (process.env.SMTP_HOST) {
    console.log(`   SMTP: ${process.env.SMTP_USER}@${process.env.SMTP_HOST}`);
  }

  if (process.env.SENTRY_DSN) {
    console.log(`   Sentry: Configured`);
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log(`   Telegram Bot: Configured (@${process.env.TELEGRAM_BOT_USERNAME || 'unknown'})`);
  }

  console.log('');
}

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable name
 * @param {any} defaultValue - Default value if not set
 * @returns {any} - Environment variable value or default
 */
export function getEnv(key, defaultValue = undefined) {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value;
}

/**
 * Get environment variable as integer
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Default value if not set
 * @returns {number} - Environment variable as integer
 */
export function getEnvInt(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get environment variable as boolean
 * @param {string} key - Environment variable name
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean} - Environment variable as boolean
 */
export function getEnvBool(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Check if running in production
 * @returns {boolean}
 */
export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 * @returns {boolean}
 */
export function isDevelopment() {
  return !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test environment
 * @returns {boolean}
 */
export function isTest() {
  return process.env.NODE_ENV === 'test';
}
