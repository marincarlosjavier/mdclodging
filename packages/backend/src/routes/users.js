import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { authenticate, requireSupervisor, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/users
 * List all users in tenant
 */
router.get('/', requireSupervisor, asyncHandler(async (req, res) => {
  const { role, is_active, logged_in } = req.query;

  let query = 'SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users WHERE tenant_id = $1';
  const params = [req.tenantId];
  let paramCount = 1;

  if (role) {
    paramCount++;
    query += ` AND $${paramCount} = ANY(role)`;
    params.push(role);
  }

  if (is_active !== undefined) {
    paramCount++;
    query += ` AND is_active = $${paramCount}`;
    params.push(is_active === 'true');
  }

  // Filter by logged in users (based on telegram is_logged_in)
  if (logged_in === 'true') {
    query += ` AND EXISTS (
      SELECT 1 FROM telegram_contacts tc
      WHERE tc.user_id = users.id
      AND tc.is_logged_in = true
    )`;
  }

  query += ' ORDER BY created_at DESC';

  console.log('[DEBUG users.js] Query:', query);
  console.log('[DEBUG users.js] Params:', params);

  const result = await pool.query(query, params);

  console.log('[DEBUG users.js] Found users:', result.rows.length);
  console.log('[DEBUG users.js] Users:', result.rows.map(u => ({ id: u.id, full_name: u.full_name, role: u.role })));

  res.json(result.rows);
}));

/**
 * GET /api/users/:id
 * Get single user
 */
router.get('/:id', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT id, email, full_name, role, is_active, api_token, last_login_at, created_at
     FROM users
     WHERE id = $1 AND tenant_id = $2`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/users
 * Create new user
 */
router.post('/', requireSupervisor, asyncHandler(async (req, res) => {
  const { email, password, full_name, role } = req.body;

  // Validation
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({
      error: 'Missing required fields: email, password, full_name, role'
    });
  }

  const validRoles = ['admin', 'supervisor', 'housekeeping', 'maintenance'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: `Invalid role. Allowed: ${validRoles.join(', ')}`
    });
  }

  // Only admins can create other admins
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create admin users' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  const apiToken = uuidv4();

  try {
    const result = await pool.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, api_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, api_token, created_at`,
      [req.tenantId, email, passwordHash, full_name, role, apiToken]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Email already exists in this organization' });
    }
    throw error;
  }
}));

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, full_name, role, is_active } = req.body;

  // Check if user exists
  const current = await pool.query(
    'SELECT * FROM users WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Only admins can change roles or deactivate users
  if ((role || is_active !== undefined) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can change roles or active status' });
  }

  // Prevent self-deactivation
  if (is_active === false && req.user.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  const result = await pool.query(
    `UPDATE users SET
      email = COALESCE($1, email),
      full_name = COALESCE($2, full_name),
      role = COALESCE($3, role),
      is_active = COALESCE($4, is_active),
      updated_at = NOW()
    WHERE id = $5 AND tenant_id = $6
    RETURNING id, email, full_name, role, is_active, updated_at`,
    [email, full_name, role, is_active, id, req.tenantId]
  );

  res.json(result.rows[0]);
}));

/**
 * PUT /api/users/:id/password
 * Change user password
 */
router.put('/:id/password', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { current_password, new_password } = req.body;

  // Users can only change their own password, unless they're admin
  if (req.user.id !== parseInt(id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot change other users passwords' });
  }

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Get current user
  const userResult = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify current password (if not admin)
  if (req.user.role !== 'admin') {
    if (!current_password) {
      return res.status(400).json({ error: 'Current password required' });
    }

    const validPassword = await bcrypt.compare(
      current_password,
      userResult.rows[0].password_hash
    );

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(new_password, 10);

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3',
    [passwordHash, id, req.tenantId]
  );

  res.json({ message: 'Password updated successfully' });
}));

/**
 * POST /api/users/:id/regenerate-api-token
 * Regenerate API token for user
 */
router.post('/:id/regenerate-api-token', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const apiToken = uuidv4();

  const result = await pool.query(
    `UPDATE users SET api_token = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, email, api_token`,
    [apiToken, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent self-deletion
  if (req.user.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Check if user exists
  const current = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Soft delete (deactivate) instead of hard delete
  await pool.query(
    'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  res.json({ message: 'User deactivated successfully' });
}));

/**
 * GET /api/users/me
 * Get current user profile
 */
router.get('/me', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.last_login_at, u.created_at,
            t.name as tenant_name, t.subdomain
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  res.json(result.rows[0]);
}));

export default router;
