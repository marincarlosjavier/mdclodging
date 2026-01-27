import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { getTokenFromCookie } from './cookieAuth.js';
import { isTokenBlacklisted } from './tokenBlacklist.js';
import { logPermissionDenied } from '../services/auditLogger.js';

// Authenticate JWT token
export async function authenticateToken(req, res, next) {
  // Try to get token from cookie first (preferred), then Authorization header (legacy)
  let token = getTokenFromCookie(req);

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted (revoked)
    if (decoded.jti && await isTokenBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Get user from database with tenant info
    const result = await pool.query(
      `SELECT u.*, t.name as tenant_name, t.subdomain as tenant_subdomain
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid token or user deactivated' });
    }

    req.user = result.rows[0];
    req.tenantId = result.rows[0].tenant_id;
    req.decodedToken = decoded; // Store decoded token for logout/refresh
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Authenticate API token (for external integrations)
export async function authenticateApiToken(req, res, next) {
  const apiToken = req.headers['x-api-token'];

  if (!apiToken) {
    return res.status(401).json({ error: 'API token required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, t.name as tenant_name, t.subdomain as tenant_subdomain
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.api_token = $1 AND u.is_active = true`,
      [apiToken]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid API token' });
    }

    req.user = result.rows[0];
    req.tenantId = result.rows[0].tenant_id;
    req.isApiRequest = true;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication error' });
  }
}

// Combined authentication (supports JWT from cookie, Authorization header, and API token)
export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiToken = req.headers['x-api-token'];
  const cookieToken = getTokenFromCookie(req);

  // Priority: API token > Cookie > Authorization header
  if (apiToken) {
    return authenticateApiToken(req, res, next);
  } else if (cookieToken || authHeader) {
    return authenticateToken(req, res, next);
  } else {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

// Require specific role (supports both single role and array of roles)
export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Support both string role and array of roles
    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];

    // Check if user has at least one of the required roles
    const hasRequiredRole = userRoles.some(userRole => roles.includes(userRole));

    if (!hasRequiredRole) {
      // Log permission denied
      await logPermissionDenied(req, roles, req.path);

      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: userRoles
      });
    }

    next();
  };
}

// Convenience middleware for common roles
export const requireAdmin = requireRole('admin');
export const requireSupervisor = requireRole('admin', 'supervisor');
export const requireStaff = requireRole('admin', 'supervisor', 'housekeeping', 'maintenance');

// Tenant isolation middleware (ensures all queries filter by tenant)
export function tenantIsolation(req, res, next) {
  if (!req.tenantId) {
    return res.status(500).json({ error: 'Tenant context missing' });
  }

  // Add tenant filter helper to request
  req.addTenantFilter = (query) => {
    return `${query} ${query.toLowerCase().includes('where') ? 'AND' : 'WHERE'} tenant_id = ${req.tenantId}`;
  };

  next();
}
