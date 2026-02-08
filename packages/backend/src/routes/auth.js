import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { asyncHandler } from '../middleware/error.js';
import { v4 as uuidv4 } from 'uuid';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  isAccountLocked,
  recordFailedLogin,
  resetFailedAttempts
} from '../middleware/accountLockout.js';
import {
  validateLogin,
  validateRegisterTenant,
  validateRefreshToken
} from '../middleware/validators/auth.validators.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/cookieAuth.js';
import { authenticate } from '../middleware/auth.js';
import { blacklistToken } from '../middleware/tokenBlacklist.js';
import {
  logLoginSuccess,
  logLoginFailed,
  logAccountLocked,
  logLogout
} from '../services/auditLogger.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', authLimiter, (req, res, next) => {
  console.log('Login request received:', {
    body: req.body,
    headers: req.headers['content-type'],
    method: req.method
  });
  next();
}, validateLogin, asyncHandler(async (req, res) => {
  const { email, password, subdomain } = req.body;

  // Find user with tenant
  let query = `
    SELECT u.*, t.name as tenant_name, t.subdomain, t.is_active as tenant_active
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.email = $1 AND u.is_active = true
  `;

  const params = [email];

  // If subdomain provided, filter by it
  if (subdomain) {
    query += ' AND t.subdomain = $2';
    params.push(subdomain);
  }

  const result = await pool.query(query, params);

  if (result.rows.length === 0) {
    // Log failed login - user not found
    await logLoginFailed(req, email, 'Invalid credentials', null);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];

  // Check if tenant is active
  if (!user.tenant_active) {
    return res.status(403).json({ error: 'Account suspended. Please contact support.' });
  }

  // Check if account is locked
  const lockStatus = await isAccountLocked(user.id);
  if (lockStatus.isLocked) {
    const minutesRemaining = Math.ceil((lockStatus.lockedUntil - new Date()) / 60000);
    // Log locked account login attempt
    await logLoginFailed(req, email, 'Account locked', 0);
    return res.status(423).json({
      error: 'Account locked due to too many failed login attempts',
      message: `Your account is locked. Please try again in ${minutesRemaining} minutes.`,
      lockedUntil: lockStatus.lockedUntil
    });
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    // Record failed login attempt
    const failedAttempt = await recordFailedLogin(user.id);

    if (failedAttempt.locked) {
      // Log account lockout
      await logAccountLocked(req, user.id, user.email);
      return res.status(423).json({
        error: 'Account locked',
        message: 'Too many failed login attempts. Your account has been locked for 15 minutes.',
        lockedUntil: failedAttempt.lockedUntil
      });
    }

    // Log failed login attempt
    await logLoginFailed(req, email, 'Invalid password', failedAttempt.attemptsRemaining);
    return res.status(401).json({
      error: 'Invalid credentials',
      attemptsRemaining: failedAttempt.attemptsRemaining
    });
  }

  // Reset failed login attempts on successful login
  await resetFailedAttempts(user.id);

  // Update last login
  await pool.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  // Log successful login
  await logLoginSuccess(req, user.id, user.email);

  // Generate unique JTI (JWT ID) for token revocation support
  const jti = uuidv4();

  // Generate JWT token with JTI
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      jti
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  // Set httpOnly cookie
  setAuthCookie(res, token);

  // Return user data (token is in httpOnly cookie, not in response body for security)
  res.json({
    token, // TEMPORARY: Keep for backwards compatibility during transition. Remove in production.
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        subdomain: user.subdomain
      }
    }
  });
}));

/**
 * Helper function to detect conflict type and suggest recovery
 */
async function detectRegistrationConflict(client, admin_email, subdomain) {
  // Check if user exists
  const userCheck = await client.query(
    `SELECT u.id, u.tenant_id, u.email, u.full_name, u.created_at,
            t.name as tenant_name, t.subdomain
     FROM users u
     JOIN tenants t ON u.tenant_id = t.id
     WHERE u.email = $1`,
    [admin_email]
  );

  // Check if subdomain exists
  const subdomainCheck = await client.query(
    `SELECT t.id, t.name, t.subdomain, t.created_at,
            (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND 'admin' = ANY(role)) as admin_count,
            (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users
     FROM tenants t
     WHERE t.subdomain = $1`,
    [subdomain]
  );

  const userExists = userCheck.rows.length > 0;
  const subdomainExists = subdomainCheck.rows.length > 0;
  const user = userCheck.rows[0];
  const tenant = subdomainCheck.rows[0];

  // Scenario 1: User exists with complete account
  if (userExists && user.tenant_id) {
    return {
      conflict: true,
      type: 'account_exists',
      message: 'Ya tienes una cuenta registrada con este email.',
      details: {
        email: admin_email,
        tenant_name: user.tenant_name,
        subdomain: user.subdomain,
        registered_date: user.created_at
      },
      suggestions: [
        { action: 'login', text: '¿Olvidaste tu contraseña? Recupérala aquí', url: '/forgot-password' },
        { action: 'use_different_email', text: 'Registrar otra empresa con email diferente' }
      ]
    };
  }

  // Scenario 2: Subdomain exists but no admin (orphaned tenant)
  if (subdomainExists && tenant.admin_count === 0) {
    return {
      conflict: true,
      type: 'incomplete_registration',
      message: 'Encontramos un registro incompleto. Vamos a completarlo.',
      details: {
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        can_complete: true
      },
      suggestions: [
        { action: 'complete_registration', text: 'Completar registro automáticamente' }
      ]
    };
  }

  // Scenario 3: Subdomain exists with admin (different user trying same subdomain)
  if (subdomainExists && tenant.admin_count > 0) {
    return {
      conflict: true,
      type: 'subdomain_taken',
      message: 'Este subdominio ya está en uso por otra empresa.',
      details: {
        subdomain: subdomain,
        suggested_alternatives: [
          `${subdomain}2`,
          `${subdomain}${new Date().getFullYear()}`,
          `${subdomain}${Math.floor(Math.random() * 1000)}`
        ]
      },
      suggestions: [
        { action: 'use_different_subdomain', text: 'Usar un subdominio diferente' },
        { action: 'auto_generate', text: 'Generar subdominio único automáticamente' }
      ]
    };
  }

  // No conflict
  return {
    conflict: false,
    type: 'none'
  };
}

/**
 * POST /api/auth/register-tenant
 * Register new tenant with admin user
 */
router.post('/register-tenant', authLimiter, validateRegisterTenant, asyncHandler(async (req, res) => {
  const {
    tenant_name,
    subdomain: requestedSubdomain,
    tenant_email,
    tenant_phone,
    admin_name,
    admin_email,
    admin_password,
    force_complete // Flag to complete incomplete registration
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Auto-generate unique subdomain if not provided
    let subdomain = requestedSubdomain;
    if (!subdomain) {
      // Generate from tenant name, fallback to timestamp-based unique ID
      const baseSubdomain = tenant_name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) || 'tenant';

      // Add unique suffix to ensure uniqueness (using more entropy)
      const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      subdomain = `${baseSubdomain}${uniqueSuffix}`;
    }

    // Detect conflicts before proceeding
    const conflictCheck = await detectRegistrationConflict(client, admin_email, subdomain);

    if (conflictCheck.conflict) {
      await client.query('ROLLBACK');

      // Special case: Incomplete registration that can be completed
      if (conflictCheck.type === 'incomplete_registration' && force_complete) {
        // Allow to proceed and complete the registration
        const tenantId = conflictCheck.details.tenant_id;

        // Hash password
        const passwordHash = await bcrypt.hash(admin_password, 10);
        const apiToken = uuidv4();

        await client.query('BEGIN');

        // Create admin user
        const userResult = await client.query(
          `INSERT INTO users (tenant_id, email, password_hash, full_name, role, api_token)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, email, full_name, role`,
          [tenantId, admin_email, passwordHash, admin_name, ['admin'], apiToken]
        );

        // Create default system settings if missing
        const settingsCheck = await client.query(
          'SELECT COUNT(*) FROM system_settings WHERE tenant_id = $1',
          [tenantId]
        );

        if (parseInt(settingsCheck.rows[0].count) === 0) {
          const defaultSettings = [
            { key: 'telegram_bot_enabled', value: 'false', type: 'boolean' },
            { key: 'telegram_bot_token', value: '', type: 'string' },
            { key: 'notification_enabled', value: 'true', type: 'boolean' }
          ];

          for (const setting of defaultSettings) {
            await client.query(
              `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type)
               VALUES ($1, $2, $3, $4)`,
              [tenantId, setting.key, setting.value, setting.type]
            );
          }
        }

        await client.query('COMMIT');

        // Generate JWT token
        const jti = uuidv4();
        const token = jwt.sign(
          {
            userId: userResult.rows[0].id,
            email: admin_email,
            role: 'admin',
            tenantId: tenantId,
            jti
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        setAuthCookie(res, token);

        return res.status(201).json({
          message: 'Registro completado exitosamente',
          completed_incomplete_registration: true,
          token,
          tenant: {
            id: tenantId,
            name: conflictCheck.details.tenant_name,
            subdomain: subdomain
          },
          user: {
            id: userResult.rows[0].id,
            email: userResult.rows[0].email,
            full_name: userResult.rows[0].full_name,
            role: userResult.rows[0].role,
            api_token: apiToken
          }
        });
      }

      // Return detailed conflict information
      return res.status(409).json({
        error: conflictCheck.message,
        conflict_type: conflictCheck.type,
        details: conflictCheck.details,
        suggestions: conflictCheck.suggestions
      });
    }

    // No conflicts, proceed with normal registration
    // (Subdomain might have been regenerated if there was a collision)

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, subdomain, email, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenant_name, subdomain, tenant_email, tenant_phone]
    );

    const tenantId = tenantResult.rows[0].id;

    // Hash password
    const passwordHash = await bcrypt.hash(admin_password, 10);
    const apiToken = uuidv4();

    // Create admin user
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, api_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role`,
      [tenantId, admin_email, passwordHash, admin_name, ['admin'], apiToken]
    );

    // Create default system settings
    const defaultSettings = [
      { key: 'telegram_bot_enabled', value: 'false', type: 'boolean' },
      { key: 'telegram_bot_token', value: '', type: 'string' },
      { key: 'notification_enabled', value: 'true', type: 'boolean' }
    ];

    for (const setting of defaultSettings) {
      await client.query(
        `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, setting.key, setting.value, setting.type]
      );
    }

    await client.query('COMMIT');

    // Generate unique JTI for token revocation support
    const jti = uuidv4();

    // Generate JWT token with JTI
    const token = jwt.sign(
      {
        userId: userResult.rows[0].id,
        email: admin_email,
        role: 'admin',
        tenantId: tenantId,
        jti
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set httpOnly cookie
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Tenant created successfully',
      token, // TEMPORARY: Keep for backwards compatibility during transition
      tenant: {
        id: tenantId,
        name: tenant_name,
        subdomain: subdomain
      },
      user: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        full_name: userResult.rows[0].full_name,
        role: userResult.rows[0].role,
        api_token: apiToken
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');

    // Handle specific database errors
    if (error.code === '23505') {
      // Unique constraint violation
      if (error.constraint === 'users_tenant_id_email_key') {
        return res.status(409).json({ error: 'Email already exists. Please use a different email address.' });
      }
      if (error.constraint === 'tenants_subdomain_key') {
        return res.status(409).json({ error: 'Subdomain already taken. Please choose a different subdomain.' });
      }
      return res.status(409).json({ error: 'This information is already registered in the system.' });
    }

    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/auth/refresh
 * Refresh JWT token (optional - extend session)
 */
router.post('/refresh', validateRefreshToken, asyncHandler(async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Blacklist the old token if it has a JTI
    if (decoded.jti) {
      const expiresAt = new Date(decoded.exp * 1000);
      await blacklistToken({
        jti: decoded.jti,
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        expiresAt,
        reason: 'token_refresh'
      });
    }

    // Generate new JTI for the new token
    const jti = uuidv4();

    // Generate new token with new JTI
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId,
        jti
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set new cookie
    setAuthCookie(res, newToken);

    res.json({ token: newToken }); // TEMPORARY: Keep for backwards compatibility
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}));

/**
 * POST /api/auth/logout
 * Logout user and clear authentication cookie
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // Blacklist the current token if it has a JTI
  if (req.user && req.decodedToken?.jti) {
    const expiresAt = new Date(req.decodedToken.exp * 1000);
    await blacklistToken({
      jti: req.decodedToken.jti,
      userId: req.user.id,
      tenantId: req.user.tenant_id,
      expiresAt,
      reason: 'logout'
    });
  }

  // Log logout event
  await logLogout(req);

  // Clear httpOnly cookie
  clearAuthCookie(res);

  res.json({
    message: 'Logged out successfully'
  });
}));

export default router;
