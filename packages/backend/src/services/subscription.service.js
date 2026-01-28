import { pool } from '../config/database.js';

/**
 * Subscription Service
 * Handles all subscription-related business logic
 */

/**
 * Get all available subscription plans
 * @param {boolean} activeOnly - Only return active plans
 * @returns {Promise<Array>} - List of plans
 */
export async function getPlans(activeOnly = true) {
  let query = 'SELECT * FROM subscription_plans';

  if (activeOnly) {
    query += ' WHERE is_active = true';
  }

  query += ' ORDER BY price_monthly_cop ASC';

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Get a specific plan by ID or name
 * @param {number|string} planIdOrName - Plan ID or name
 * @returns {Promise<Object|null>} - Plan details or null
 */
export async function getPlan(planIdOrName) {
  const isNumeric = !isNaN(planIdOrName);

  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE ${isNumeric ? 'id' : 'name'} = $1`,
    [planIdOrName]
  );

  return result.rows[0] || null;
}

/**
 * Get subscription for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object|null>} - Subscription with plan details
 */
export async function getSubscription(tenantId) {
  const result = await pool.query(
    `SELECT s.*,
            sp.name as plan_name,
            sp.display_name as plan_display_name,
            sp.price_monthly_cop,
            sp.max_users,
            sp.max_properties,
            sp.max_tasks_per_month,
            sp.max_storage_mb,
            sp.features
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.tenant_id = $1`,
    [tenantId]
  );

  return result.rows[0] || null;
}

/**
 * Create a new subscription (typically for new tenant)
 * @param {number} tenantId - Tenant ID
 * @param {string|number} planIdOrName - Plan ID or name (default: 'trial')
 * @param {number} trialDays - Trial period in days (default: 14)
 * @returns {Promise<Object>} - Created subscription
 */
export async function createSubscription(tenantId, planIdOrName = 'trial', trialDays = 14) {
  const plan = await getPlan(planIdOrName);

  if (!plan) {
    throw new Error(`Plan not found: ${planIdOrName}`);
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const result = await pool.query(
    `INSERT INTO subscriptions
     (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
     VALUES ($1, $2, 'trialing', $3, $4, $5)
     RETURNING *`,
    [tenantId, plan.id, trialEnd, now, periodEnd]
  );

  // Log to subscription history
  await logSubscriptionChange(
    result.rows[0].id,
    null,
    plan.id,
    null,
    'trialing',
    'subscription_created',
    null
  );

  return result.rows[0];
}

/**
 * Upgrade or downgrade a subscription
 * @param {number} tenantId - Tenant ID
 * @param {string|number} newPlanIdOrName - New plan ID or name
 * @param {number} userId - User making the change (optional)
 * @returns {Promise<Object>} - Updated subscription with proration info
 */
export async function changePlan(tenantId, newPlanIdOrName, userId = null) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  const newPlan = await getPlan(newPlanIdOrName);

  if (!newPlan) {
    throw new Error(`Plan not found: ${newPlanIdOrName}`);
  }

  if (subscription.plan_id === newPlan.id) {
    throw new Error('Already on this plan');
  }

  const oldPlan = await getPlan(subscription.plan_id);

  // Calculate proration
  const proration = calculateProration(subscription, oldPlan, newPlan);

  // Update subscription
  await pool.query(
    `UPDATE subscriptions
     SET plan_id = $1, updated_at = NOW()
     WHERE tenant_id = $2`,
    [newPlan.id, tenantId]
  );

  // Log change
  await logSubscriptionChange(
    subscription.id,
    oldPlan.id,
    newPlan.id,
    subscription.status,
    subscription.status,
    proration.isUpgrade ? 'plan_upgraded' : 'plan_downgraded',
    userId
  );

  return {
    subscription: await getSubscription(tenantId),
    proration
  };
}

/**
 * Cancel a subscription
 * @param {number} tenantId - Tenant ID
 * @param {boolean} immediate - Cancel immediately or at period end
 * @param {number} userId - User making the change (optional)
 * @returns {Promise<Object>} - Updated subscription
 */
export async function cancelSubscription(tenantId, immediate = false, userId = null) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  if (subscription.status === 'canceled') {
    throw new Error('Subscription already canceled');
  }

  const now = new Date();

  if (immediate) {
    // Cancel immediately
    await pool.query(
      `UPDATE subscriptions
       SET status = 'canceled',
           canceled_at = $1,
           cancel_at_period_end = false,
           updated_at = NOW()
       WHERE tenant_id = $2`,
      [now, tenantId]
    );

    await logSubscriptionChange(
      subscription.id,
      subscription.plan_id,
      subscription.plan_id,
      subscription.status,
      'canceled',
      'immediate_cancellation',
      userId
    );
  } else {
    // Cancel at period end
    await pool.query(
      `UPDATE subscriptions
       SET cancel_at_period_end = true,
           canceled_at = $1,
           updated_at = NOW()
       WHERE tenant_id = $2`,
      [now, tenantId]
    );

    await logSubscriptionChange(
      subscription.id,
      subscription.plan_id,
      subscription.plan_id,
      subscription.status,
      subscription.status,
      'scheduled_cancellation',
      userId
    );
  }

  return await getSubscription(tenantId);
}

/**
 * Reactivate a canceled subscription
 * @param {number} tenantId - Tenant ID
 * @param {number} userId - User making the change (optional)
 * @returns {Promise<Object>} - Updated subscription
 */
export async function reactivateSubscription(tenantId, userId = null) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  if (!subscription.cancel_at_period_end && subscription.status !== 'canceled') {
    throw new Error('Subscription is not canceled');
  }

  await pool.query(
    `UPDATE subscriptions
     SET cancel_at_period_end = false,
         canceled_at = NULL,
         status = CASE
           WHEN status = 'canceled' AND current_period_end > NOW() THEN 'active'
           ELSE status
         END,
         updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId]
  );

  await logSubscriptionChange(
    subscription.id,
    subscription.plan_id,
    subscription.plan_id,
    subscription.status,
    'active',
    'reactivated',
    userId
  );

  return await getSubscription(tenantId);
}

/**
 * Update subscription status (e.g., trial ended, payment failed)
 * @param {number} tenantId - Tenant ID
 * @param {string} newStatus - New status
 * @param {string} reason - Reason for status change
 * @returns {Promise<Object>} - Updated subscription
 */
export async function updateSubscriptionStatus(tenantId, newStatus, reason = null) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  await pool.query(
    `UPDATE subscriptions
     SET status = $1, updated_at = NOW()
     WHERE tenant_id = $2`,
    [newStatus, tenantId]
  );

  await logSubscriptionChange(
    subscription.id,
    subscription.plan_id,
    subscription.plan_id,
    subscription.status,
    newStatus,
    reason || `status_changed_to_${newStatus}`,
    null
  );

  return await getSubscription(tenantId);
}

/**
 * Calculate proration when changing plans
 * @param {Object} subscription - Current subscription
 * @param {Object} oldPlan - Old plan
 * @param {Object} newPlan - New plan
 * @returns {Object} - Proration details
 */
function calculateProration(subscription, oldPlan, newPlan) {
  const now = new Date();
  const periodStart = new Date(subscription.current_period_start);
  const periodEnd = new Date(subscription.current_period_end);

  // Calculate days remaining in period
  const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
  const daysUsed = totalDays - daysRemaining;

  // Calculate unused credit from old plan
  const unusedCredit = Math.floor((oldPlan.price_monthly_cop / totalDays) * daysRemaining);

  // Calculate cost for remaining days on new plan
  const newPlanCost = Math.floor((newPlan.price_monthly_cop / totalDays) * daysRemaining);

  // Calculate proration amount
  const proratedAmount = newPlanCost - unusedCredit;

  const isUpgrade = newPlan.price_monthly_cop > oldPlan.price_monthly_cop;

  return {
    isUpgrade,
    oldPlanPrice: oldPlan.price_monthly_cop,
    newPlanPrice: newPlan.price_monthly_cop,
    daysRemaining,
    daysUsed,
    totalDays,
    unusedCredit,
    newPlanCost,
    proratedAmount: Math.max(0, proratedAmount), // Never negative
    description: isUpgrade
      ? `Upgrade to ${newPlan.display_name}. You'll be charged ${proratedAmount} COP now for the remaining ${daysRemaining} days.`
      : `Downgrade to ${newPlan.display_name}. Your unused credit of ${Math.abs(proratedAmount)} COP will be applied to your next invoice.`
  };
}

/**
 * Log subscription change to history
 * @param {number} subscriptionId - Subscription ID
 * @param {number} oldPlanId - Old plan ID (optional)
 * @param {number} newPlanId - New plan ID (optional)
 * @param {string} oldStatus - Old status (optional)
 * @param {string} newStatus - New status (optional)
 * @param {string} reason - Reason for change
 * @param {number} userId - User who made the change (optional)
 */
async function logSubscriptionChange(subscriptionId, oldPlanId, newPlanId, oldStatus, newStatus, reason, userId) {
  await pool.query(
    `INSERT INTO subscription_history
     (subscription_id, old_plan_id, new_plan_id, old_status, new_status, reason, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [subscriptionId, oldPlanId, newPlanId, oldStatus, newStatus, reason, userId]
  );
}

/**
 * Check if tenant has access to a feature
 * @param {number} tenantId - Tenant ID
 * @param {string} featureName - Feature name (e.g., 'telegram_bot', 'api_access')
 * @returns {Promise<boolean>} - True if tenant has access
 */
export async function hasFeatureAccess(tenantId, featureName) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    return false;
  }

  // Check if subscription is active or in trial
  if (!['active', 'trialing'].includes(subscription.status)) {
    return false;
  }

  // Check if feature is enabled in plan
  return subscription.features?.[featureName] === true;
}

/**
 * Get current usage for a tenant
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Usage statistics
 */
export async function getCurrentUsage(tenantId) {
  const [users, properties, tasksThisMonth, storage] = await Promise.all([
    pool.query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND is_active = true',
      [tenantId]
    ),
    pool.query(
      'SELECT COUNT(*) as count FROM properties WHERE tenant_id = $1',
      [tenantId]
    ),
    pool.query(
      `SELECT COUNT(*) as count FROM cleaning_tasks
       WHERE tenant_id = $1
       AND created_at >= date_trunc('month', CURRENT_DATE)`,
      [tenantId]
    ),
    // TODO: Calculate actual storage when file uploads are implemented
    Promise.resolve({ rows: [{ total_mb: 0 }] })
  ]);

  return {
    users: parseInt(users.rows[0].count),
    properties: parseInt(properties.rows[0].count),
    tasks_this_month: parseInt(tasksThisMonth.rows[0].count),
    storage_mb: parseInt(storage.rows[0].total_mb || 0)
  };
}

/**
 * Check if usage is within plan limits
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Quota status with violations
 */
export async function checkQuotas(tenantId) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    throw new Error('No subscription found for tenant');
  }

  const usage = await getCurrentUsage(tenantId);

  const quotaStatus = {
    users: {
      current: usage.users,
      limit: subscription.max_users,
      exceeded: usage.users > subscription.max_users,
      percentage: Math.round((usage.users / subscription.max_users) * 100)
    },
    properties: {
      current: usage.properties,
      limit: subscription.max_properties,
      exceeded: usage.properties > subscription.max_properties,
      percentage: Math.round((usage.properties / subscription.max_properties) * 100)
    },
    tasks_this_month: {
      current: usage.tasks_this_month,
      limit: subscription.max_tasks_per_month,
      exceeded: usage.tasks_this_month > subscription.max_tasks_per_month,
      percentage: Math.round((usage.tasks_this_month / subscription.max_tasks_per_month) * 100)
    },
    storage_mb: {
      current: usage.storage_mb,
      limit: subscription.max_storage_mb,
      exceeded: usage.storage_mb > subscription.max_storage_mb,
      percentage: Math.round((usage.storage_mb / subscription.max_storage_mb) * 100)
    }
  };

  const violations = [];

  for (const [key, quota] of Object.entries(quotaStatus)) {
    if (quota.exceeded) {
      violations.push({
        quota_type: key,
        limit: quota.limit,
        current: quota.current
      });
    }
  }

  return {
    quotaStatus,
    hasViolations: violations.length > 0,
    violations
  };
}

/**
 * Get subscription history for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {number} limit - Maximum records to return
 * @returns {Promise<Array>} - History entries
 */
export async function getSubscriptionHistory(tenantId) {
  const subscription = await getSubscription(tenantId);

  if (!subscription) {
    return [];
  }

  const result = await pool.query(
    `SELECT sh.*,
            op.display_name as old_plan_name,
            np.display_name as new_plan_name,
            u.full_name as changed_by_name
     FROM subscription_history sh
     LEFT JOIN subscription_plans op ON op.id = sh.old_plan_id
     LEFT JOIN subscription_plans np ON np.id = sh.new_plan_id
     LEFT JOIN users u ON u.id = sh.changed_by
     WHERE sh.subscription_id = $1
     ORDER BY sh.changed_at DESC
     LIMIT 50`,
    [subscription.id]
  );

  return result.rows;
}
