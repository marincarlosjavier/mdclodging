import { pool } from '../config/database.js';
import { getSubscription, getPlan, getCurrentUsage } from '../services/subscription.service.js';
import { logger } from '../config/logger.js';

/**
 * Check if tenant can create a new user
 * Enforces max_users quota from subscription plan
 */
export async function checkUserQuota(req, res, next) {
  try {
    const subscription = await getSubscription(req.tenantId);

    if (!subscription) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Please activate a subscription to add users'
      });
    }

    const plan = await getPlan(subscription.plan_id);

    const userCount = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true',
      [req.tenantId]
    );

    const currentUsers = parseInt(userCount.rows[0].count);

    if (currentUsers >= plan.max_users) {
      logger.warn('User quota exceeded', {
        tenantId: req.tenantId,
        currentUsers,
        maxUsers: plan.max_users,
        planName: plan.name
      });

      return res.status(403).json({
        error: 'User limit reached',
        message: `Your ${plan.display_name} plan allows up to ${plan.max_users} users. You currently have ${currentUsers} active users.`,
        limit: plan.max_users,
        current: currentUsers,
        upgrade_url: '/billing/plans',
        quota_type: 'users'
      });
    }

    // Add quota info to request for logging
    req.quotaInfo = {
      users: {
        current: currentUsers,
        limit: plan.max_users,
        remaining: plan.max_users - currentUsers
      }
    };

    next();
  } catch (error) {
    logger.error('Error checking user quota', {
      error: error.message,
      tenantId: req.tenantId
    });
    return res.status(500).json({
      error: 'Error checking quota',
      message: 'Please try again later'
    });
  }
}

/**
 * Check if tenant can create a new property
 * Enforces max_properties quota from subscription plan
 */
export async function checkPropertyQuota(req, res, next) {
  try {
    const subscription = await getSubscription(req.tenantId);

    if (!subscription) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Please activate a subscription to add properties'
      });
    }

    const plan = await getPlan(subscription.plan_id);

    const propertyCount = await pool.query(
      'SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1',
      [req.tenantId]
    );

    const currentProperties = parseInt(propertyCount.rows[0].count);

    if (currentProperties >= plan.max_properties) {
      logger.warn('Property quota exceeded', {
        tenantId: req.tenantId,
        currentProperties,
        maxProperties: plan.max_properties,
        planName: plan.name
      });

      return res.status(403).json({
        error: 'Property limit reached',
        message: `Your ${plan.display_name} plan allows up to ${plan.max_properties} properties. You currently have ${currentProperties} properties.`,
        limit: plan.max_properties,
        current: currentProperties,
        upgrade_url: '/billing/plans',
        quota_type: 'properties'
      });
    }

    req.quotaInfo = {
      properties: {
        current: currentProperties,
        limit: plan.max_properties,
        remaining: plan.max_properties - currentProperties
      }
    };

    next();
  } catch (error) {
    logger.error('Error checking property quota', {
      error: error.message,
      tenantId: req.tenantId
    });
    return res.status(500).json({
      error: 'Error checking quota',
      message: 'Please try again later'
    });
  }
}

/**
 * Check if tenant can create a new cleaning task
 * Enforces max_tasks_per_month quota from subscription plan
 */
export async function checkTaskQuota(req, res, next) {
  try {
    const subscription = await getSubscription(req.tenantId);

    if (!subscription) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Please activate a subscription to create tasks'
      });
    }

    const plan = await getPlan(subscription.plan_id);

    // Get tasks created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const taskCount = await pool.query(
      `SELECT COUNT(*) as count FROM cleaning_tasks
       WHERE tenant_id = $1 AND created_at >= $2`,
      [req.tenantId, startOfMonth]
    );

    const currentTasks = parseInt(taskCount.rows[0].count);

    if (currentTasks >= plan.max_tasks_per_month) {
      logger.warn('Task quota exceeded', {
        tenantId: req.tenantId,
        currentTasks,
        maxTasks: plan.max_tasks_per_month,
        planName: plan.name
      });

      return res.status(403).json({
        error: 'Monthly task limit reached',
        message: `Your ${plan.display_name} plan allows up to ${plan.max_tasks_per_month} tasks per month. You have created ${currentTasks} tasks this month.`,
        limit: plan.max_tasks_per_month,
        current: currentTasks,
        upgrade_url: '/billing/plans',
        quota_type: 'tasks_per_month',
        period: 'monthly'
      });
    }

    req.quotaInfo = {
      tasks: {
        current: currentTasks,
        limit: plan.max_tasks_per_month,
        remaining: plan.max_tasks_per_month - currentTasks,
        period: 'monthly'
      }
    };

    next();
  } catch (error) {
    logger.error('Error checking task quota', {
      error: error.message,
      tenantId: req.tenantId
    });
    return res.status(500).json({
      error: 'Error checking quota',
      message: 'Please try again later'
    });
  }
}

/**
 * Check if tenant can upload a file based on storage quota
 * Enforces max_storage_mb quota from subscription plan
 */
export async function checkStorageQuota(req, res, next) {
  try {
    const subscription = await getSubscription(req.tenantId);

    if (!subscription) {
      return res.status(403).json({
        error: 'No active subscription',
        message: 'Please activate a subscription to upload files'
      });
    }

    const plan = await getPlan(subscription.plan_id);

    // Calculate current storage usage
    // TODO: This is a placeholder - implement actual storage calculation
    // when file uploads are fully implemented
    const storageQuery = await pool.query(
      `SELECT COALESCE(SUM(file_size), 0) as total_bytes
       FROM uploads
       WHERE tenant_id = $1`,
      [req.tenantId]
    );

    const currentStorageBytes = parseInt(storageQuery.rows[0]?.total_bytes || 0);
    const currentStorageMB = Math.ceil(currentStorageBytes / (1024 * 1024));

    // Get file size from request if available
    const fileSize = req.file?.size || req.body?.fileSize || 0;
    const fileSizeMB = Math.ceil(fileSize / (1024 * 1024));

    const projectedStorageMB = currentStorageMB + fileSizeMB;

    if (projectedStorageMB > plan.max_storage_mb) {
      logger.warn('Storage quota exceeded', {
        tenantId: req.tenantId,
        currentStorageMB,
        fileSizeMB,
        projectedStorageMB,
        maxStorageMB: plan.max_storage_mb,
        planName: plan.name
      });

      return res.status(403).json({
        error: 'Storage limit exceeded',
        message: `Your ${plan.display_name} plan allows up to ${plan.max_storage_mb} MB of storage. This upload would exceed your limit.`,
        limit: plan.max_storage_mb,
        current: currentStorageMB,
        fileSize: fileSizeMB,
        projected: projectedStorageMB,
        upgrade_url: '/billing/plans',
        quota_type: 'storage_mb'
      });
    }

    req.quotaInfo = {
      storage: {
        current: currentStorageMB,
        limit: plan.max_storage_mb,
        remaining: plan.max_storage_mb - currentStorageMB,
        unit: 'MB'
      }
    };

    next();
  } catch (error) {
    logger.error('Error checking storage quota', {
      error: error.message,
      tenantId: req.tenantId
    });
    return res.status(500).json({
      error: 'Error checking quota',
      message: 'Please try again later'
    });
  }
}

/**
 * Check if tenant has access to a specific feature
 * Enforces feature flags from subscription plan
 */
export function checkFeatureAccess(featureName) {
  return async (req, res, next) => {
    try {
      const subscription = await getSubscription(req.tenantId);

      if (!subscription) {
        return res.status(403).json({
          error: 'No active subscription',
          message: 'Please activate a subscription'
        });
      }

      const plan = await getPlan(subscription.plan_id);

      // Check if feature is enabled in plan
      const hasAccess = plan.features?.[featureName] === true;

      if (!hasAccess) {
        logger.warn('Feature access denied', {
          tenantId: req.tenantId,
          feature: featureName,
          planName: plan.name
        });

        return res.status(403).json({
          error: 'Feature not available',
          message: `Your ${plan.display_name} plan does not include access to ${featureName}. Please upgrade to access this feature.`,
          feature: featureName,
          upgrade_url: '/billing/plans'
        });
      }

      next();
    } catch (error) {
      logger.error('Error checking feature access', {
        error: error.message,
        tenantId: req.tenantId,
        feature: featureName
      });
      return res.status(500).json({
        error: 'Error checking feature access',
        message: 'Please try again later'
      });
    }
  };
}

/**
 * Log quota violation to database for analytics
 */
async function logQuotaViolation(tenantId, quotaType, limitValue, actualValue) {
  try {
    await pool.query(
      `INSERT INTO quota_violations
       (tenant_id, quota_type, limit_value, actual_value)
       VALUES ($1, $2, $3, $4)`,
      [tenantId, quotaType, limitValue, actualValue]
    );
  } catch (error) {
    logger.error('Error logging quota violation', {
      error: error.message,
      tenantId,
      quotaType
    });
  }
}

/**
 * Middleware to check subscription status is active
 * Rejects requests if subscription is past_due, canceled, suspended, or expired
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const subscription = await getSubscription(req.tenantId);

    if (!subscription) {
      return res.status(403).json({
        error: 'No subscription found',
        message: 'Please contact support to activate your subscription'
      });
    }

    const allowedStatuses = ['active', 'trialing'];

    if (!allowedStatuses.includes(subscription.status)) {
      logger.warn('Inactive subscription access attempt', {
        tenantId: req.tenantId,
        status: subscription.status
      });

      const messages = {
        past_due: 'Your subscription payment is past due. Please update your payment method.',
        canceled: 'Your subscription has been canceled. Please reactivate to continue.',
        suspended: 'Your account has been suspended. Please contact support.',
        expired: 'Your trial has expired. Please subscribe to continue using the service.'
      };

      return res.status(403).json({
        error: 'Subscription inactive',
        message: messages[subscription.status] || 'Your subscription is not active.',
        status: subscription.status,
        upgrade_url: '/billing/plans'
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking subscription status', {
      error: error.message,
      tenantId: req.tenantId
    });
    return res.status(500).json({
      error: 'Error checking subscription',
      message: 'Please try again later'
    });
  }
}
