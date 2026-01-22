import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { asyncHandler } from '../middleware/error.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password, subdomain } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

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
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];

  // Check if tenant is active
  if (!user.tenant_active) {
    return res.status(403).json({ error: 'Account suspended. Please contact support.' });
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  await pool.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  // Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
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
 * POST /api/auth/register-tenant
 * Register new tenant with admin user
 */
router.post('/register-tenant', asyncHandler(async (req, res) => {
  const {
    tenant_name,
    subdomain,
    tenant_email,
    tenant_phone,
    admin_name,
    admin_email,
    admin_password
  } = req.body;

  // Validation
  if (!tenant_name || !subdomain || !admin_name || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Validate subdomain format
  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return res.status(400).json({
      error: 'Subdomain can only contain lowercase letters, numbers, and hyphens'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if subdomain exists
    const subdomainCheck = await client.query(
      'SELECT id FROM tenants WHERE subdomain = $1',
      [subdomain]
    );

    if (subdomainCheck.rows.length > 0) {
      throw new Error('Subdomain already taken');
    }

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
      [tenantId, admin_email, passwordHash, admin_name, 'admin', apiToken]
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

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: userResult.rows[0].id,
        email: admin_email,
        role: 'admin',
        tenantId: tenantId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Tenant created successfully',
      token,
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
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * POST /api/auth/refresh
 * Refresh JWT token (optional - extend session)
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Generate new token
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}));

export default router;
