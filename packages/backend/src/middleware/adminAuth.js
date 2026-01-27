import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { logger } from '../config/logger.js';

/**
 * Authenticate platform admin
 * Platform admins are NOT tenant-scoped - they manage the entire platform
 */
export async function authenticateAdmin(req, res, next) {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.auth_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Platform admin access requires authentication'
      });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists
    const result = await pool.query(
      'SELECT id, email, role, tenant_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      });
    }

    // Check if user is platform admin
    // Platform admins are identified by having 'platform_admin' role
    // OR being an admin in tenant_id = 1 (platform tenant)
    const isPlatformAdmin =
      user.role.includes('platform_admin') ||
      (user.tenant_id === 1 && user.role.includes('admin'));

    if (!isPlatformAdmin) {
      logger.warn('Non-admin attempted to access admin API', {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        ip: req.ip
      });

      return res.status(403).json({
        error: 'Access denied',
        message: 'Platform admin access required'
      });
    }

    // Attach user info to request
    req.user = user;
    req.adminUserId = user.id;

    logger.info('Platform admin authenticated', {
      adminId: user.id,
      email: user.email,
      ip: req.ip,
      path: req.path
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Authentication token has expired'
      });
    }

    logger.error('Admin authentication error', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
}

/**
 * Check if user has platform admin access (helper function)
 * @param {number} userId - User ID to check
 * @returns {Promise<boolean>} - True if user is platform admin
 */
export async function isPlatformAdmin(userId) {
  try {
    const result = await pool.query(
      'SELECT role, tenant_id FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const user = result.rows[0];

    return (
      user.role.includes('platform_admin') ||
      (user.tenant_id === 1 && user.role.includes('admin'))
    );
  } catch (error) {
    logger.error('Error checking platform admin status', {
      error: error.message,
      userId
    });
    return false;
  }
}
