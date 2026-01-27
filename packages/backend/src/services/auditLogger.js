import { pool } from '../config/database.js';

/**
 * Event types for audit logging
 */
export const AuditEventType = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // User management events
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ROLE_CHANGED: 'ROLE_CHANGED',

  // Authorization events
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',

  // Tenant management
  TENANT_CREATED: 'TENANT_CREATED',
  TENANT_UPDATED: 'TENANT_UPDATED',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',

  // Data access
  DATA_EXPORT: 'DATA_EXPORT',
  SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS'
};

/**
 * Event categories
 */
export const AuditCategory = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  USER_MANAGEMENT: 'user_management',
  TENANT_MANAGEMENT: 'tenant_management',
  DATA_ACCESS: 'data_access',
  SECURITY: 'security'
};

/**
 * Severity levels
 */
export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {number} params.tenantId - Tenant ID
 * @param {number} params.userId - User ID (null if not authenticated)
 * @param {string} params.eventType - Event type from AuditEventType
 * @param {string} params.eventCategory - Event category from AuditCategory
 * @param {string} params.severity - Severity level from AuditSeverity
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.userAgent - User agent string
 * @param {string} params.resourceType - Type of resource affected (optional)
 * @param {number} params.resourceId - ID of resource affected (optional)
 * @param {Object} params.details - Additional details in JSON format
 * @param {boolean} params.success - Whether the action succeeded
 * @param {Object} params.req - Express request object (alternative to individual fields)
 * @returns {Promise<void>}
 */
export async function logAuditEvent({
  tenantId,
  userId,
  eventType,
  eventCategory,
  severity,
  ipAddress,
  userAgent,
  resourceType,
  resourceId,
  details,
  success,
  req
}) {
  try {
    // Extract from req if provided
    if (req) {
      ipAddress = ipAddress || req.ip || req.connection?.remoteAddress;
      userAgent = userAgent || req.get('user-agent');
      tenantId = tenantId || req.tenantId;
      userId = userId || req.user?.id;
    }

    await pool.query(
      `INSERT INTO audit_logs
       (tenant_id, user_id, event_type, event_category, severity,
        ip_address, user_agent, resource_type, resource_id, details, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        tenantId,
        userId,
        eventType,
        eventCategory,
        severity,
        ipAddress,
        userAgent,
        resourceType,
        resourceId,
        details ? JSON.stringify(details) : null,
        success
      ]
    );
  } catch (error) {
    // Don't throw errors from audit logging - log to console instead
    console.error('Failed to write audit log:', error.message);
  }
}

/**
 * Log authentication success
 */
export async function logLoginSuccess(req, userId, email) {
  await logAuditEvent({
    req,
    userId,
    eventType: AuditEventType.LOGIN_SUCCESS,
    eventCategory: AuditCategory.AUTHENTICATION,
    severity: AuditSeverity.INFO,
    details: { email },
    success: true
  });
}

/**
 * Log authentication failure
 */
export async function logLoginFailed(req, email, reason, attemptsRemaining) {
  await logAuditEvent({
    req,
    userId: null,
    eventType: AuditEventType.LOGIN_FAILED,
    eventCategory: AuditCategory.AUTHENTICATION,
    severity: attemptsRemaining <= 2 ? AuditSeverity.WARNING : AuditSeverity.INFO,
    details: { email, reason, attemptsRemaining },
    success: false
  });
}

/**
 * Log account lockout
 */
export async function logAccountLocked(req, userId, email) {
  await logAuditEvent({
    req,
    userId,
    eventType: AuditEventType.ACCOUNT_LOCKED,
    eventCategory: AuditCategory.SECURITY,
    severity: AuditSeverity.WARNING,
    details: { email, reason: 'Too many failed login attempts' },
    success: true
  });
}

/**
 * Log logout
 */
export async function logLogout(req) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.LOGOUT,
    eventCategory: AuditCategory.AUTHENTICATION,
    severity: AuditSeverity.INFO,
    details: {},
    success: true
  });
}

/**
 * Log permission denied
 */
export async function logPermissionDenied(req, requiredRole, action) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.PERMISSION_DENIED,
    eventCategory: AuditCategory.AUTHORIZATION,
    severity: AuditSeverity.WARNING,
    details: {
      requiredRole,
      userRole: req.user?.role,
      action
    },
    success: false
  });
}

/**
 * Log user creation
 */
export async function logUserCreated(req, createdUserId, createdUserEmail, role) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.USER_CREATED,
    eventCategory: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.INFO,
    resourceType: 'user',
    resourceId: createdUserId,
    details: { email: createdUserEmail, role },
    success: true
  });
}

/**
 * Log user deletion
 */
export async function logUserDeleted(req, deletedUserId, deletedUserEmail) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.USER_DELETED,
    eventCategory: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.WARNING,
    resourceType: 'user',
    resourceId: deletedUserId,
    details: { email: deletedUserEmail },
    success: true
  });
}

/**
 * Log role change
 */
export async function logRoleChanged(req, targetUserId, targetUserEmail, oldRole, newRole) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.ROLE_CHANGED,
    eventCategory: AuditCategory.USER_MANAGEMENT,
    severity: AuditSeverity.WARNING,
    resourceType: 'user',
    resourceId: targetUserId,
    details: { email: targetUserEmail, oldRole, newRole },
    success: true
  });
}

/**
 * Log password change
 */
export async function logPasswordChanged(req, targetUserId, targetUserEmail) {
  await logAuditEvent({
    req,
    eventType: AuditEventType.PASSWORD_CHANGED,
    eventCategory: AuditCategory.SECURITY,
    severity: AuditSeverity.INFO,
    resourceType: 'user',
    resourceId: targetUserId,
    details: { email: targetUserEmail },
    success: true
  });
}

/**
 * Query audit logs with filters
 * @param {Object} filters - Query filters
 * @param {number} filters.tenantId - Filter by tenant
 * @param {number} filters.userId - Filter by user
 * @param {string} filters.eventType - Filter by event type
 * @param {string} filters.eventCategory - Filter by category
 * @param {string} filters.severity - Filter by severity
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {number} filters.limit - Max results (default 100)
 * @param {number} filters.offset - Offset for pagination
 * @returns {Promise<Array>} - Audit log entries
 */
export async function queryAuditLogs(filters = {}) {
  const {
    tenantId,
    userId,
    eventType,
    eventCategory,
    severity,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = filters;

  let query = `
    SELECT al.*, u.email as user_email, u.full_name as user_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (tenantId) {
    paramCount++;
    query += ` AND al.tenant_id = $${paramCount}`;
    params.push(tenantId);
  }

  if (userId) {
    paramCount++;
    query += ` AND al.user_id = $${paramCount}`;
    params.push(userId);
  }

  if (eventType) {
    paramCount++;
    query += ` AND al.event_type = $${paramCount}`;
    params.push(eventType);
  }

  if (eventCategory) {
    paramCount++;
    query += ` AND al.event_category = $${paramCount}`;
    params.push(eventCategory);
  }

  if (severity) {
    paramCount++;
    query += ` AND al.severity = $${paramCount}`;
    params.push(severity);
  }

  if (startDate) {
    paramCount++;
    query += ` AND al.created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND al.created_at <= $${paramCount}`;
    params.push(endDate);
  }

  query += ` ORDER BY al.created_at DESC`;

  paramCount++;
  query += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get audit statistics
 * @param {number} tenantId - Tenant ID
 * @param {Date} startDate - Start date (optional)
 * @param {Date} endDate - End date (optional)
 * @returns {Promise<Object>} - Statistics
 */
export async function getAuditStats(tenantId, startDate, endDate) {
  let query = `
    SELECT
      COUNT(*) as total_events,
      COUNT(CASE WHEN success = true THEN 1 END) as successful_events,
      COUNT(CASE WHEN success = false THEN 1 END) as failed_events,
      COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_events,
      COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_events,
      COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_events,
      COUNT(CASE WHEN event_type = 'LOGIN_FAILED' THEN 1 END) as failed_logins,
      COUNT(CASE WHEN event_type = 'PERMISSION_DENIED' THEN 1 END) as permission_denials
    FROM audit_logs
    WHERE tenant_id = $1
  `;

  const params = [tenantId];
  let paramCount = 1;

  if (startDate) {
    paramCount++;
    query += ` AND created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND created_at <= $${paramCount}`;
    params.push(endDate);
  }

  const result = await pool.query(query, params);
  return result.rows[0];
}
