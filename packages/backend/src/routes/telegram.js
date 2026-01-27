import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireAdmin, requireSupervisor } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getBotInstance, isBotRunning, getLastError, clearLastError, startTelegramBot, stopTelegramBot } from '../telegram/bot.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/telegram/status
 * Get bot status for tenant
 */
router.get('/status', requireAdmin, asyncHandler(async (req, res) => {
  // Get bot configuration
  const settingsResult = await pool.query(
    `SELECT setting_key, setting_value FROM system_settings
     WHERE tenant_id = $1 AND setting_key LIKE 'telegram_%'`,
    [req.tenantId]
  );

  const settings = {};
  settingsResult.rows.forEach(row => {
    settings[row.setting_key] = row.setting_value;
  });

  const lastError = getLastError();

  res.json({
    enabled: settings.telegram_bot_enabled === 'true',
    running: isBotRunning(),
    username: settings.telegram_bot_username || null,
    has_token: !!(settings.telegram_bot_token && settings.telegram_bot_token !== ''),
    last_error: lastError,
    has_error: lastError !== null
  });
}));

/**
 * POST /api/telegram/configure
 * Configure Telegram bot for tenant
 */
router.post('/configure', requireAdmin, asyncHandler(async (req, res) => {
  const { bot_token, bot_username, enabled } = req.body;

  // Update settings
  if (bot_token !== undefined) {
    await pool.query(
      `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type)
       VALUES ($1, 'telegram_bot_token', $2, 'string')
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [req.tenantId, bot_token]
    );
  }

  if (bot_username !== undefined) {
    await pool.query(
      `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type)
       VALUES ($1, 'telegram_bot_username', $2, 'string')
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [req.tenantId, bot_username]
    );
  }

  if (enabled !== undefined) {
    await pool.query(
      `INSERT INTO system_settings (tenant_id, setting_key, setting_value, setting_type)
       VALUES ($1, 'telegram_bot_enabled', $2, 'boolean')
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [req.tenantId, enabled.toString()]
    );
  }

  // Clear last error when updating configuration
  clearLastError();

  res.json({ message: 'Configuration updated successfully' });
}));

/**
 * POST /api/telegram/start
 * Start Telegram bot
 */
router.post('/start', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await startTelegramBot();
    res.json({ message: 'Bot started successfully', success: true });
  } catch (error) {
    console.error('Error starting bot:', error);

    // Parse error message for better user feedback
    let userMessage = error.message;
    if (error.message.includes('401')) {
      userMessage = 'Token inválido o no autorizado. Verifica que el token sea correcto y esté activo en @BotFather.';
    } else if (error.message.includes('404')) {
      userMessage = 'Bot no encontrado. Verifica que el token sea correcto.';
    } else if (error.message.includes('No Telegram bot configured')) {
      userMessage = 'No hay configuración de Telegram. Por favor configura el token del bot primero.';
    }

    res.status(400).json({
      error: userMessage,
      success: false,
      technical_error: error.message
    });
  }
}));

/**
 * POST /api/telegram/stop
 * Stop Telegram bot
 */
router.post('/stop', requireAdmin, asyncHandler(async (req, res) => {
  stopTelegramBot();
  res.json({ message: 'Bot stopped successfully' });
}));

/**
 * POST /api/telegram/generate-link-code
 * Generate linking code for user
 */
router.post('/generate-link-code', requireSupervisor, asyncHandler(async (req, res) => {
  const { user_id, permission_ids } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  if (!permission_ids || !Array.isArray(permission_ids) || permission_ids.length === 0) {
    return res.status(400).json({
      error: 'Debes seleccionar al menos un permiso de Telegram antes de generar el código'
    });
  }

  // Verify user belongs to same tenant
  const userCheck = await pool.query(
    'SELECT id, email, full_name, role FROM users WHERE id = $1 AND tenant_id = $2',
    [user_id, req.tenantId]
  );

  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Verify all permissions exist and are active
  const permissionsCheck = await pool.query(
    `SELECT id, code, name FROM telegram_permissions_catalog
     WHERE id = ANY($1) AND is_active = true`,
    [permission_ids]
  );

  if (permissionsCheck.rows.length !== permission_ids.length) {
    return res.status(400).json({
      error: 'Uno o más permisos seleccionados son inválidos o están inactivos'
    });
  }

  // Check if user already has an active code
  const existingCode = await pool.query(
    `SELECT id, code, expires_at FROM telegram_link_codes
     WHERE tenant_id = $1 AND user_id = $2 AND used = false AND expires_at > NOW()`,
    [req.tenantId, user_id]
  );

  if (existingCode.rows.length > 0) {
    return res.status(400).json({
      error: 'Este usuario ya tiene un código activo',
      existing_code: existingCode.rows[0].code
    });
  }

  // Generate unique code (6-8 characters)
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `INSERT INTO telegram_link_codes (tenant_id, user_id, code, expires_at, created_by, pending_permissions)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.tenantId, user_id, code, expiresAt, req.user.id, permission_ids]
  );

  res.json({
    code,
    expires_at: expiresAt,
    user: userCheck.rows[0],
    pending_permissions: permissionsCheck.rows
  });
}));

/**
 * GET /api/telegram/contacts
 * List Telegram contacts with their permissions
 */
router.get('/contacts', requireSupervisor, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT tc.*,
            u.email, u.full_name, u.role,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', tpc.id,
                  'code', tpc.code,
                  'name', tpc.name
                )
              ) FILTER (WHERE tpc.id IS NOT NULL),
              '[]'
            ) as telegram_permissions
     FROM telegram_contacts tc
     LEFT JOIN users u ON u.id = tc.user_id
     LEFT JOIN telegram_contact_permissions tcp ON tcp.contact_id = tc.id
     LEFT JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
     WHERE tc.tenant_id = $1
        OR (tc.tenant_id IS NULL AND tc.user_id IN (
          SELECT id FROM users WHERE tenant_id = $1
        ))
        OR (tc.tenant_id IS NULL AND tc.user_id IS NULL)
     GROUP BY tc.id, u.email, u.full_name, u.role
     ORDER BY tc.linked_at DESC NULLS LAST, tc.created_at DESC`,
    [req.tenantId]
  );

  res.json(result.rows);
}));

/**
 * GET /api/telegram/link-codes
 * List active link codes
 */
router.get('/link-codes', requireSupervisor, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT lc.*,
            u.email, u.full_name, u.role,
            creator.full_name as created_by_name
     FROM telegram_link_codes lc
     JOIN users u ON u.id = lc.user_id
     JOIN users creator ON creator.id = lc.created_by
     WHERE lc.tenant_id = $1 AND lc.used = false AND lc.expires_at > NOW()
     ORDER BY lc.created_at DESC`,
    [req.tenantId]
  );

  res.json(result.rows);
}));

/**
 * DELETE /api/telegram/link-codes/:id
 * Revoke/delete link code
 */
router.delete('/link-codes/:id', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM telegram_link_codes WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Link code not found' });
  }

  res.json({ message: 'Link code revoked successfully' });
}));

/**
 * PUT /api/telegram/contacts/:id/unlink
 * Unlink Telegram contact from user
 */
router.put('/contacts/:id/unlink', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE telegram_contacts SET
      user_id = NULL,
      tenant_id = NULL,
      linked_at = NULL,
      login_pin = NULL,
      is_active = false,
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  res.json({ message: 'Contact unlinked successfully', contact: result.rows[0] });
}));

/**
 * PUT /api/telegram/contacts/:id/reset-pin
 * Reset PIN for contact
 */
router.put('/contacts/:id/reset-pin', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE telegram_contacts SET
      login_pin = NULL,
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING id`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  res.json({ message: 'PIN reset successfully. User will be prompted to set new PIN.' });
}));

/**
 * PUT /api/telegram/contacts/:id/activate
 * Activate contact
 */
router.put('/contacts/:id/activate', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE telegram_contacts SET
      is_active = true,
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  res.json({ message: 'Contact activated successfully', contact: result.rows[0] });
}));

/**
 * PUT /api/telegram/contacts/:id/deactivate
 * Deactivate contact
 */
router.put('/contacts/:id/deactivate', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE telegram_contacts SET
      is_active = false,
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  res.json({ message: 'Contact deactivated successfully', contact: result.rows[0] });
}));

/**
 * PUT /api/telegram/contacts/:id/role
 * Update user roles for contact (supports multiple roles)
 */
router.put('/contacts/:id/role', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roles } = req.body;

  // Validate roles
  const validRoles = ['admin', 'supervisor', 'housekeeping', 'maintenance'];
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Roles must be a non-empty array' });
  }

  const invalidRoles = roles.filter(r => !validRoles.includes(r));
  if (invalidRoles.length > 0) {
    return res.status(400).json({ error: `Invalid roles: ${invalidRoles.join(', ')}. Must be one of: ${validRoles.join(', ')}` });
  }

  // Get contact with user_id
  const contactResult = await pool.query(
    'SELECT user_id FROM telegram_contacts WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  const userId = contactResult.rows[0].user_id;
  if (!userId) {
    return res.status(400).json({ error: 'Contact is not linked to a user yet' });
  }

  // Update user roles
  const updateResult = await pool.query(
    `UPDATE users SET
      role = $1::text[],
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
    RETURNING id, full_name, email, role`,
    [roles, userId, req.tenantId]
  );

  if (updateResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    message: 'User roles updated successfully',
    user: updateResult.rows[0]
  });
}));

/**
 * PUT /api/telegram/users/:userId/role
 * Update user roles directly (for pending users, supports multiple roles)
 */
router.put('/users/:userId/role', requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { roles } = req.body;

  // Validate roles
  const validRoles = ['admin', 'supervisor', 'housekeeping', 'maintenance'];
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Roles must be a non-empty array' });
  }

  const invalidRoles = roles.filter(r => !validRoles.includes(r));
  if (invalidRoles.length > 0) {
    return res.status(400).json({ error: `Invalid roles: ${invalidRoles.join(', ')}. Must be one of: ${validRoles.join(', ')}` });
  }

  // Update user roles
  const updateResult = await pool.query(
    `UPDATE users SET
      role = $1::text[],
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
    RETURNING id, full_name, email, role`,
    [roles, userId, req.tenantId]
  );

  if (updateResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    message: 'User roles updated successfully',
    user: updateResult.rows[0]
  });
}));

/**
 * GET /api/telegram/permissions-catalog
 * Get catalog of available Telegram permissions
 */
router.get('/permissions-catalog', requireSupervisor, asyncHandler(async (req, res) => {
  const showAll = req.query.all === 'true';

  const result = await pool.query(
    `SELECT id, code, name, description, permissions, is_active, created_at, updated_at
     FROM telegram_permissions_catalog
     ${showAll ? '' : 'WHERE is_active = true'}
     ORDER BY id`
  );

  res.json(result.rows);
}));

/**
 * POST /api/telegram/permissions-catalog
 * Create new Telegram permission
 */
router.post('/permissions-catalog', requireAdmin, asyncHandler(async (req, res) => {
  const { code, name, description, permissions } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Code and name are required' });
  }

  // Check if code already exists
  const existing = await pool.query(
    'SELECT id FROM telegram_permissions_catalog WHERE code = $1',
    [code]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Permission code already exists' });
  }

  const result = await pool.query(
    `INSERT INTO telegram_permissions_catalog (code, name, description, permissions)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [code, name, description || '', permissions || {}]
  );

  res.json(result.rows[0]);
}));

/**
 * PUT /api/telegram/permissions-catalog/:id
 * Update Telegram permission
 */
router.put('/permissions-catalog/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, name, description, permissions, is_active } = req.body;

  // Check if code is taken by another permission
  if (code) {
    const existing = await pool.query(
      'SELECT id FROM telegram_permissions_catalog WHERE code = $1 AND id != $2',
      [code, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Permission code already exists' });
    }
  }

  const result = await pool.query(
    `UPDATE telegram_permissions_catalog
     SET code = COALESCE($1, code),
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         permissions = COALESCE($4, permissions),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [code, name, description, permissions, is_active, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Permission not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/telegram/permissions-catalog/:id
 * Delete Telegram permission (soft delete by setting is_active = false)
 */
router.delete('/permissions-catalog/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if permission is in use
  const inUse = await pool.query(
    'SELECT COUNT(*) as count FROM telegram_contact_permissions WHERE permission_id = $1',
    [id]
  );

  if (parseInt(inUse.rows[0].count) > 0) {
    // Soft delete - just deactivate
    await pool.query(
      'UPDATE telegram_permissions_catalog SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
    return res.json({ message: 'Permission deactivated (was in use)', soft_delete: true });
  }

  // Hard delete if not in use
  const result = await pool.query(
    'DELETE FROM telegram_permissions_catalog WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Permission not found' });
  }

  res.json({ message: 'Permission deleted successfully', soft_delete: false });
}));

/**
 * PUT /api/telegram/contacts/:id/permissions
 * Update Telegram permissions for contact (from catalog)
 */
router.put('/contacts/:id/permissions', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permission_ids } = req.body;

  if (!permission_ids || !Array.isArray(permission_ids)) {
    return res.status(400).json({ error: 'permission_ids must be an array' });
  }

  // Verify contact exists and belongs to tenant
  const contactResult = await pool.query(
    'SELECT id FROM telegram_contacts WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
    [id, req.tenantId]
  );

  if (contactResult.rows.length === 0) {
    return res.status(404).json({ error: 'Contact not found' });
  }

  // Verify all permission IDs are valid
  if (permission_ids.length > 0) {
    const permsResult = await pool.query(
      'SELECT id FROM telegram_permissions_catalog WHERE id = ANY($1::int[])',
      [permission_ids]
    );

    if (permsResult.rows.length !== permission_ids.length) {
      return res.status(400).json({ error: 'One or more invalid permission IDs' });
    }
  }

  // Begin transaction
  await pool.query('BEGIN');

  try {
    // Delete existing permissions
    await pool.query(
      'DELETE FROM telegram_contact_permissions WHERE contact_id = $1',
      [id]
    );

    // Insert new permissions
    if (permission_ids.length > 0) {
      const values = permission_ids.map((permId, idx) =>
        `($1, $${idx + 2}, NOW(), $${permission_ids.length + 2})`
      ).join(', ');

      await pool.query(
        `INSERT INTO telegram_contact_permissions (contact_id, permission_id, granted_at, granted_by)
         VALUES ${values}`,
        [id, ...permission_ids, req.user.id]
      );
    }

    await pool.query('COMMIT');

    // Return updated contact with permissions
    const updatedResult = await pool.query(
      `SELECT tc.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', tpc.id,
                    'code', tpc.code,
                    'name', tpc.name
                  )
                ) FILTER (WHERE tpc.id IS NOT NULL),
                '[]'
              ) as telegram_permissions
       FROM telegram_contacts tc
       LEFT JOIN telegram_contact_permissions tcp ON tcp.contact_id = tc.id
       LEFT JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
       WHERE tc.id = $1
       GROUP BY tc.id`,
      [id]
    );

    res.json({
      message: 'Permissions updated successfully',
      contact: updatedResult.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}));

export default router;
