import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireAdmin, requireSupervisor } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getBotInstance, startTelegramBot, stopTelegramBot } from '../telegram/bot.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/telegram/status
 * Get bot status for tenant
 */
router.get('/status', requireAdmin, asyncHandler(async (req, res) => {
  const bot = getBotInstance(req.tenantId);

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

  res.json({
    enabled: settings.telegram_bot_enabled === 'true',
    running: bot !== null,
    username: settings.telegram_bot_username || null,
    has_token: settings.telegram_bot_token !== ''
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

  res.json({ message: 'Configuration updated successfully' });
}));

/**
 * POST /api/telegram/start
 * Start Telegram bot
 */
router.post('/start', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await startTelegramBot();
    res.json({ message: 'Bot started successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  // Verify user belongs to same tenant
  const userCheck = await pool.query(
    'SELECT id, email, full_name, role FROM users WHERE id = $1 AND tenant_id = $2',
    [user_id, req.tenantId]
  );

  if (userCheck.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Generate unique code (6-8 characters)
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `INSERT INTO telegram_link_codes (tenant_id, user_id, code, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.tenantId, user_id, code, expiresAt, req.user.id]
  );

  res.json({
    code,
    expires_at: expiresAt,
    user: userCheck.rows[0]
  });
}));

/**
 * GET /api/telegram/contacts
 * List Telegram contacts
 */
router.get('/contacts', requireSupervisor, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT tc.*,
            u.email, u.full_name, u.role
     FROM telegram_contacts tc
     LEFT JOIN users u ON u.id = tc.user_id
     WHERE tc.tenant_id = $1 OR (tc.tenant_id IS NULL AND tc.user_id IN (
       SELECT id FROM users WHERE tenant_id = $1
     ))
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

export default router;
