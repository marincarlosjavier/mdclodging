# Environment Variable Configuration Guide

This document describes all environment variables used by MDCLodging and validation requirements.

## Quick Start

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```bash
nano .env  # or use your preferred editor
```

3. Start the server:
```bash
npm start
```

The server will automatically validate all environment variables on startup and will **not start** if required variables are missing or invalid.

## Validation Levels

### ❌ REQUIRED (Application will not start without these)

These variables are **mandatory** for all environments:

- `JWT_SECRET` - **Must be 32+ characters**. Used for signing JWT tokens.
  - Generate securely: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - **CRITICAL**: Change from default in production!

- `DB_HOST` - Database server hostname (e.g., `localhost`)
- `DB_PORT` - Database server port (1-65535)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

### ⚠️ PRODUCTION REQUIRED (Required when NODE_ENV=production)

These become **mandatory** in production:

- `CORS_ORIGIN` - **Must not be localhost in production**. Set to your production domain.
  - Example: `https://app.mdclodging.com`

### 💡 RECOMMENDED (Warnings if missing)

Application will run but with limited functionality:

- `SMTP_HOST` - Email server for notifications and password resets
- `SMTP_USER` - Email server username
- `SMTP_PASS` - Email server password
- `SENTRY_DSN` - Error tracking and monitoring

## All Available Variables

### Core Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment mode: `development`, `production`, `test` |
| `PORT` | No | `3000` | Server port (1-65535) |
| `CORS_ORIGIN` | Production only | `http://localhost:5173` | Allowed CORS origin |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | - | JWT signing secret (32+ chars) |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiration (e.g., `7d`, `24h`, `60m`) |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | **Yes** | - | PostgreSQL host |
| `DB_PORT` | **Yes** | - | PostgreSQL port |
| `DB_NAME` | **Yes** | - | Database name |
| `DB_USER` | **Yes** | - | Database username |
| `DB_PASSWORD` | **Yes** | - | Database password |
| `DATABASE_URL` | No | - | Full connection string (alternative to individual vars) |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | Recommended | - | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | Recommended | - | SMTP username |
| `SMTP_PASS` | Recommended | - | SMTP password |
| `SMTP_FROM` | No | - | From address for emails |
| `SMTP_SECURE` | No | `false` | Use SSL/TLS |

### Monitoring & Error Tracking

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | Recommended | - | Sentry error tracking DSN |
| `LOG_LEVEL` | No | `info` | Log level: `error`, `warn`, `info`, `debug` |
| `LOG_FILE` | No | `logs/app.log` | Log file path |
| `LOG_QUERIES` | No | `false` | Log SQL queries (debug only) |

### Telegram Bot

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | No | - | Bot token from @BotFather |
| `TELEGRAM_BOT_ENABLED` | No | `false` | Enable Telegram bot |
| `TELEGRAM_BOT_USERNAME` | No | - | Bot username |

### File Upload

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPLOAD_DIR` | No | `./uploads` | Upload directory path |
| `MAX_FILE_SIZE` | No | `5242880` | Max file size in bytes (5MB default) |
| `ALLOWED_IMAGE_TYPES` | No | `image/jpeg,image/png,image/jpg` | Allowed image MIME types |

### Future Features (Phase 2+)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | No | - | Stripe secret key for payments |
| `STRIPE_PUBLISHABLE_KEY` | No | - | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | - | Stripe webhook secret |
| `REDIS_URL` | No | - | Redis connection URL |
| `AWS_REGION` | No | - | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key |
| `S3_BUCKET` | No | - | S3 bucket for uploads |

## Validation Rules

### JWT_SECRET
- **Minimum length**: 32 characters
- **Production check**: Must not use default value
- **Recommended**: Use cryptographically random string

### DB_PORT
- **Type**: Integer
- **Range**: 1-65535

### PORT
- **Type**: Integer
- **Range**: 1-65535
- **Default**: 3000

### NODE_ENV
- **Allowed values**: `development`, `production`, `test`
- **Default**: `development`

### CORS_ORIGIN
- **Production**: Must not be `localhost`
- **Format**: Full URL (e.g., `https://example.com`)

## Startup Validation

On server startup, the application will:

1. ✅ Check all **required** variables are set
2. ✅ Validate variable formats and values
3. ⚠️ Warn about missing **recommended** variables
4. ❌ Exit with error if validation fails
5. 📋 Display configuration summary (with sensitive data masked)

### Example Success Output

```
🔍 Validating environment variables...
Environment: development

✅ Environment validation passed

📋 Configuration summary:
   Database: postgres@localhost:5432/mdclodging
   JWT Secret: ***cret_key
   CORS Origin: http://localhost:5173 (default)
   Port: 3000 (default)
   Telegram Bot: Configured (@mdclodging_bot)

⚠️  Environment warnings:
   ⚠️  SMTP_HOST is not set (recommended for full functionality)
   ⚠️  SENTRY_DSN is not set (recommended for full functionality)
```

### Example Failure Output

```
🔍 Validating environment variables...
Environment: production

❌ Environment validation failed:
   ❌ JWT_SECRET must be changed from default value in production
   ❌ CORS_ORIGIN must be set to production domain (not localhost)
   ❌ DB_PASSWORD is required but not set

💡 Please check your .env file and ensure all required variables are set.
```

## Security Best Practices

### Development
- Use `.env` file (ignored by git)
- Never commit `.env` to version control
- Use weak passwords acceptable for local development

### Production
- Use environment variables provided by hosting platform
- Use strong, unique secrets (32+ characters)
- Rotate JWT_SECRET periodically
- Use managed database services
- Enable all monitoring (Sentry, logging)
- Use HTTPS-only CORS origins

### Secret Generation

Generate secure random secrets:

```bash
# JWT Secret (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# UUID v4 (for API tokens)
node -e "console.log(require('crypto').randomUUID())"

# Random password (32 characters)
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

## Troubleshooting

### Server won't start

1. Check console output for specific validation errors
2. Verify all required variables are set in `.env`
3. Check variable formats (ports must be numbers, etc.)
4. Ensure JWT_SECRET is 32+ characters
5. In production, ensure production-required variables are set

### Environment warnings

Warnings won't prevent startup but indicate missing functionality:
- Missing SMTP = No email notifications
- Missing Sentry = No error tracking
- Missing Telegram = No bot notifications

### Database connection errors

Check after environment validation passes:
- Database is running
- Credentials are correct
- Database exists
- Port is accessible

## Environment Utilities

The application provides helper functions for accessing environment variables:

```javascript
import { getEnv, getEnvInt, getEnvBool, isProduction } from './config/validateEnv.js';

// Get string with fallback
const apiUrl = getEnv('API_URL', 'http://localhost:3000');

// Get integer with fallback
const port = getEnvInt('PORT', 3000);

// Get boolean with fallback
const debugMode = getEnvBool('DEBUG_MODE', false);

// Check environment
if (isProduction()) {
  // Production-only code
}
```
