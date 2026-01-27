import { pool } from '../config/database.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Check if account is currently locked
 * @param {number} userId - User ID to check
 * @returns {Promise<{isLocked: boolean, lockedUntil: Date|null}>}
 */
export async function isAccountLocked(userId) {
  const result = await pool.query(
    `SELECT account_locked_until, failed_login_attempts
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { isLocked: false, lockedUntil: null };
  }

  const user = result.rows[0];
  const lockedUntil = user.account_locked_until;

  // If no lockout timestamp, not locked
  if (!lockedUntil) {
    return { isLocked: false, lockedUntil: null };
  }

  // If lockout has expired, unlock the account
  if (new Date(lockedUntil) <= new Date()) {
    await unlockAccount(userId);
    return { isLocked: false, lockedUntil: null };
  }

  return { isLocked: true, lockedUntil: new Date(lockedUntil) };
}

/**
 * Record a failed login attempt
 * Locks account if max attempts exceeded
 * @param {number} userId - User ID
 * @returns {Promise<{locked: boolean, attemptsRemaining: number}>}
 */
export async function recordFailedLogin(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Increment failed attempts counter
    const result = await client.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           last_failed_login_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId]
    );

    const failedAttempts = result.rows[0].failed_login_attempts;

    // Lock account if max attempts exceeded
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = new Date();
      lockoutUntil.setMinutes(lockoutUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

      await client.query(
        `UPDATE users
         SET account_locked_until = $1
         WHERE id = $2`,
        [lockoutUntil, userId]
      );

      await client.query('COMMIT');

      return {
        locked: true,
        attemptsRemaining: 0,
        lockedUntil: lockoutUntil
      };
    }

    await client.query('COMMIT');

    return {
      locked: false,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - failedAttempts
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reset failed login attempts after successful login
 * @param {number} userId - User ID
 */
export async function resetFailedAttempts(userId) {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         account_locked_until = NULL,
         last_failed_login_at = NULL
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Manually unlock an account
 * @param {number} userId - User ID
 */
export async function unlockAccount(userId) {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         account_locked_until = NULL
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Get account lockout status with details
 * @param {number} userId - User ID
 * @returns {Promise<Object>}
 */
export async function getAccountLockoutStatus(userId) {
  const result = await pool.query(
    `SELECT failed_login_attempts, account_locked_until, last_failed_login_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  const now = new Date();
  const lockedUntil = user.account_locked_until ? new Date(user.account_locked_until) : null;
  const isLocked = lockedUntil && lockedUntil > now;

  return {
    failedAttempts: user.failed_login_attempts,
    isLocked,
    lockedUntil,
    lastFailedLogin: user.last_failed_login_at,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - user.failed_login_attempts)
  };
}

export const accountLockoutConfig = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES
};
