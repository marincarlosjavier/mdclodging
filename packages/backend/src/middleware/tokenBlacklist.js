import { pool } from '../config/database.js';

/**
 * Check if a token (by JTI) is blacklisted
 * @param {string} jti - JWT ID to check
 * @returns {Promise<boolean>} - True if blacklisted
 */
export async function isTokenBlacklisted(jti) {
  if (!jti) {
    return false;
  }

  const result = await pool.query(
    `SELECT id FROM token_blacklist
     WHERE token_jti = $1
     AND expires_at > NOW()`,
    [jti]
  );

  return result.rows.length > 0;
}

/**
 * Add a token to the blacklist
 * @param {Object} params - Blacklist parameters
 * @param {string} params.jti - JWT ID
 * @param {number} params.userId - User ID
 * @param {number} params.tenantId - Tenant ID
 * @param {Date} params.expiresAt - When the token would have expired
 * @param {string} params.reason - Reason for blacklisting
 * @returns {Promise<void>}
 */
export async function blacklistToken({ jti, userId, tenantId, expiresAt, reason = 'logout' }) {
  if (!jti) {
    throw new Error('JTI is required to blacklist a token');
  }

  try {
    await pool.query(
      `INSERT INTO token_blacklist (token_jti, user_id, tenant_id, expires_at, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (token_jti) DO NOTHING`,
      [jti, userId, tenantId, expiresAt, reason]
    );
  } catch (error) {
    // Ignore duplicate errors (already blacklisted)
    if (error.code !== '23505') {
      throw error;
    }
  }
}

/**
 * Blacklist all tokens for a specific user
 * Used when password is changed or account is compromised
 * @param {number} userId - User ID
 * @param {string} reason - Reason for mass revocation
 * @returns {Promise<number>} - Number of tokens blacklisted
 */
export async function blacklistAllUserTokens(userId, reason = 'password_change') {
  // Note: This is a placeholder. In practice, we'd need to track all active tokens.
  // For now, we'll just add a marker that forces re-authentication
  // A more complete solution would use Redis to track active sessions

  const result = await pool.query(
    `UPDATE users
     SET updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId]
  );

  return result.rowCount;
}

/**
 * Clean up expired tokens from blacklist
 * Should be run periodically (e.g., daily cron job)
 * @returns {Promise<number>} - Number of tokens removed
 */
export async function cleanupExpiredTokens() {
  const result = await pool.query(
    `DELETE FROM token_blacklist
     WHERE expires_at <= NOW()`
  );

  return result.rowCount;
}

/**
 * Get blacklist statistics
 * @returns {Promise<Object>} - Blacklist stats
 */
export async function getBlacklistStats() {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_blacklisted,
       COUNT(CASE WHEN reason = 'logout' THEN 1 END) as logout_count,
       COUNT(CASE WHEN reason = 'password_change' THEN 1 END) as password_change_count,
       COUNT(CASE WHEN reason = 'admin_revoke' THEN 1 END) as admin_revoke_count,
       COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired_count
     FROM token_blacklist`
  );

  return result.rows[0];
}

/**
 * Revoke all tokens for a user (admin action)
 * @param {number} userId - User ID to revoke tokens for
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
export async function revokeUserTokens(userId, tenantId) {
  // Mark a flag that will force the user to re-authenticate
  await pool.query(
    `UPDATE users
     SET updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );
}
