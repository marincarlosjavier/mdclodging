import express from 'express';
import { pool } from '../config/database.js';
import { authenticateAdmin } from '../middleware/adminAuth.js';
import { asyncHandler } from '../middleware/error.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// All admin routes require platform admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/admin/tenants
 * List all tenants with subscription info
 */
router.get('/tenants', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    status,
    plan,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT
      t.id,
      t.name,
      t.subdomain,
      t.is_active,
      t.created_at,
      t.updated_at,
      s.id as subscription_id,
      s.status as subscription_status,
      s.trial_ends_at,
      s.current_period_end,
      sp.name as plan_name,
      sp.display_name as plan_display_name,
      sp.price_monthly_cop,
      (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = true) as user_count,
      (SELECT COUNT(*) FROM properties WHERE tenant_id = t.id) as property_count
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (status) {
    paramCount++;
    query += ` AND s.status = $${paramCount}`;
    params.push(status);
  }

  if (plan) {
    paramCount++;
    query += ` AND sp.name = $${paramCount}`;
    params.push(plan);
  }

  if (search) {
    paramCount++;
    query += ` AND (t.name ILIKE $${paramCount} OR t.subdomain ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  // Count total for pagination
  const countResult = await pool.query(
    `SELECT COUNT(DISTINCT t.id) as total FROM tenants t
     LEFT JOIN subscriptions s ON s.tenant_id = t.id
     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE 1=1 ${status ? `AND s.status = '${status}'` : ''}
     ${plan ? `AND sp.name = '${plan}'` : ''}
     ${search ? `AND (t.name ILIKE '%${search}%' OR t.subdomain ILIKE '%${search}%')` : ''}`
  );

  const total = parseInt(countResult.rows[0].total);

  // Add sorting and pagination
  const allowedSortFields = ['created_at', 'name', 'subdomain', 'user_count', 'property_count'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${sortField} ${order}`;
  query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(parseInt(limit), offset);

  const result = await pool.query(query, params);

  logger.info('Admin fetched tenant list', {
    adminId: req.adminUserId,
    filters: { status, plan, search },
    resultCount: result.rows.length
  });

  res.json({
    tenants: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
}));

/**
 * GET /api/admin/tenants/:id
 * Get detailed tenant information
 */
router.get('/tenants/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tenantResult = await pool.query(`
    SELECT
      t.*,
      s.id as subscription_id,
      s.status as subscription_status,
      s.trial_ends_at,
      s.current_period_start,
      s.current_period_end,
      s.cancel_at_period_end,
      s.canceled_at,
      sp.id as plan_id,
      sp.name as plan_name,
      sp.display_name as plan_display_name,
      sp.price_monthly_cop,
      sp.max_users,
      sp.max_properties,
      sp.max_tasks_per_month,
      sp.max_storage_mb,
      sp.features as plan_features
    FROM tenants t
    LEFT JOIN subscriptions s ON s.tenant_id = t.id
    LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE t.id = $1
  `, [id]);

  if (tenantResult.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const tenant = tenantResult.rows[0];

  // Get usage stats
  const statsResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND is_active = true) as user_count,
      (SELECT COUNT(*) FROM properties WHERE tenant_id = $1) as property_count,
      (SELECT COUNT(*) FROM cleaning_tasks WHERE tenant_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE)) as tasks_this_month,
      (SELECT COALESCE(SUM(file_size), 0) FROM uploads WHERE tenant_id = $1) as storage_bytes
  `, [id]);

  const stats = statsResult.rows[0];
  stats.storage_mb = Math.ceil(parseInt(stats.storage_bytes || 0) / (1024 * 1024));

  // Get recent activity
  const activityResult = await pool.query(`
    SELECT event_type, event_category, created_at, success
    FROM audit_logs
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `, [id]);

  // Get quota violations
  const violationsResult = await pool.query(`
    SELECT quota_type, limit_value, actual_value, detected_at
    FROM quota_violations
    WHERE tenant_id = $1
    ORDER BY detected_at DESC
    LIMIT 10
  `, [id]);

  logger.info('Admin viewed tenant details', {
    adminId: req.adminUserId,
    tenantId: id
  });

  res.json({
    tenant,
    stats,
    recent_activity: activityResult.rows,
    quota_violations: violationsResult.rows
  });
}));

/**
 * POST /api/admin/tenants/:id/suspend
 * Suspend a tenant
 */
router.post('/tenants/:id/suspend', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  await pool.query('BEGIN');

  try {
    // Suspend tenant
    await pool.query(
      'UPDATE tenants SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Suspend subscription
    await pool.query(
      `UPDATE subscriptions
       SET status = 'suspended', updated_at = NOW()
       WHERE tenant_id = $1`,
      [id]
    );

    // Log action in audit log
    await pool.query(
      `INSERT INTO audit_logs
       (tenant_id, event_type, event_category, severity, details, success)
       VALUES ($1, 'TENANT_SUSPENDED', 'admin', 'high', $2, true)`,
      [id, JSON.stringify({ reason, suspended_by: req.adminUserId })]
    );

    await pool.query('COMMIT');

    logger.warn('Tenant suspended by admin', {
      adminId: req.adminUserId,
      tenantId: id,
      reason
    });

    res.json({
      message: 'Tenant suspended successfully',
      tenant_id: id
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}));

/**
 * POST /api/admin/tenants/:id/reactivate
 * Reactivate a suspended tenant
 */
router.post('/tenants/:id/reactivate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await pool.query('BEGIN');

  try {
    // Reactivate tenant
    await pool.query(
      'UPDATE tenants SET is_active = true, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Reactivate subscription
    await pool.query(
      `UPDATE subscriptions
       SET status = 'active', updated_at = NOW()
       WHERE tenant_id = $1 AND status = 'suspended'`,
      [id]
    );

    // Log action
    await pool.query(
      `INSERT INTO audit_logs
       (tenant_id, event_type, event_category, severity, details, success)
       VALUES ($1, 'TENANT_REACTIVATED', 'admin', 'high', $2, true)`,
      [id, JSON.stringify({ reactivated_by: req.adminUserId })]
    );

    await pool.query('COMMIT');

    logger.info('Tenant reactivated by admin', {
      adminId: req.adminUserId,
      tenantId: id
    });

    res.json({
      message: 'Tenant reactivated successfully',
      tenant_id: id
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}));

/**
 * GET /api/admin/metrics
 * Get platform-wide metrics
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  const metricsResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM tenants WHERE is_active = true) as active_tenants,
      (SELECT COUNT(*) FROM tenants) as total_tenants,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'trialing') as trial_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'past_due') as past_due_subscriptions,
      (SELECT COUNT(*) FROM subscriptions WHERE status = 'canceled') as canceled_subscriptions,
      (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
      (SELECT COUNT(*) FROM properties) as total_properties,
      (SELECT COUNT(*) FROM cleaning_tasks WHERE created_at >= date_trunc('month', CURRENT_DATE)) as tasks_this_month
  `);

  const metrics = metricsResult.rows[0];

  // Calculate MRR (Monthly Recurring Revenue)
  const mrrResult = await pool.query(`
    SELECT COALESCE(SUM(sp.price_monthly_cop), 0) as mrr
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status IN ('active', 'trialing')
  `);

  metrics.mrr = parseInt(mrrResult.rows[0].mrr);

  // Calculate ARR (Annual Recurring Revenue)
  metrics.arr = metrics.mrr * 12;

  // Get plan distribution
  const planDistResult = await pool.query(`
    SELECT sp.name, sp.display_name, COUNT(*) as tenant_count
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status IN ('active', 'trialing')
    GROUP BY sp.name, sp.display_name
    ORDER BY tenant_count DESC
  `);

  metrics.plan_distribution = planDistResult.rows;

  // Get growth metrics (new tenants this month)
  const growthResult = await pool.query(`
    SELECT COUNT(*) as new_tenants_this_month
    FROM tenants
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
  `);

  metrics.new_tenants_this_month = parseInt(growthResult.rows[0].new_tenants_this_month);

  // Calculate churn rate (canceled this month / active last month)
  const churnResult = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM subscriptions
       WHERE status = 'canceled'
       AND canceled_at >= date_trunc('month', CURRENT_DATE)) as canceled_this_month,
      (SELECT COUNT(*) FROM subscriptions
       WHERE status IN ('active', 'trialing')
       AND created_at < date_trunc('month', CURRENT_DATE)) as active_last_month
  `);

  const canceledThisMonth = parseInt(churnResult.rows[0].canceled_this_month);
  const activeLastMonth = parseInt(churnResult.rows[0].active_last_month);
  metrics.churn_rate = activeLastMonth > 0
    ? ((canceledThisMonth / activeLastMonth) * 100).toFixed(2)
    : '0.00';

  logger.info('Admin fetched platform metrics', {
    adminId: req.adminUserId
  });

  res.json(metrics);
}));

/**
 * GET /api/admin/revenue
 * Get revenue analytics
 */
router.get('/revenue', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate period start date
  let periodStart = new Date();
  if (period === '7d') {
    periodStart.setDate(periodStart.getDate() - 7);
  } else if (period === '30d') {
    periodStart.setDate(periodStart.getDate() - 30);
  } else if (period === '90d') {
    periodStart.setDate(periodStart.getDate() - 90);
  } else if (period === '1y') {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }

  // Get revenue by plan
  const revenueByPlanResult = await pool.query(`
    SELECT
      sp.name,
      sp.display_name,
      sp.price_monthly_cop,
      COUNT(s.id) as subscriber_count,
      (sp.price_monthly_cop * COUNT(s.id)) as monthly_revenue
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status IN ('active', 'trialing')
    GROUP BY sp.id, sp.name, sp.display_name, sp.price_monthly_cop
    ORDER BY monthly_revenue DESC
  `);

  // Get subscription growth over time
  const growthResult = await pool.query(`
    SELECT
      DATE_TRUNC('day', created_at) as date,
      COUNT(*) as new_subscriptions
    FROM subscriptions
    WHERE created_at >= $1
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date ASC
  `, [periodStart]);

  // Total revenue metrics
  const totalResult = await pool.query(`
    SELECT
      COALESCE(SUM(sp.price_monthly_cop), 0) as current_mrr,
      COUNT(s.id) as total_subscribers
    FROM subscriptions s
    JOIN subscription_plans sp ON sp.id = s.plan_id
    WHERE s.status IN ('active', 'trialing')
  `);

  res.json({
    period,
    total: {
      mrr: parseInt(totalResult.rows[0].current_mrr),
      arr: parseInt(totalResult.rows[0].current_mrr) * 12,
      subscribers: parseInt(totalResult.rows[0].total_subscribers)
    },
    by_plan: revenueByPlanResult.rows,
    growth: growthResult.rows
  });
}));

/**
 * GET /api/admin/activity
 * Get recent platform activity
 */
router.get('/activity', asyncHandler(async (req, res) => {
  const { limit = 50, tenant_id, event_type } = req.query;

  let query = `
    SELECT
      al.*,
      t.name as tenant_name,
      t.subdomain,
      u.email as user_email
    FROM audit_logs al
    LEFT JOIN tenants t ON t.id = al.tenant_id
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;

  const params = [];
  let paramCount = 0;

  if (tenant_id) {
    paramCount++;
    query += ` AND al.tenant_id = $${paramCount}`;
    params.push(tenant_id);
  }

  if (event_type) {
    paramCount++;
    query += ` AND al.event_type = $${paramCount}`;
    params.push(event_type);
  }

  query += ` ORDER BY al.created_at DESC LIMIT $${paramCount + 1}`;
  params.push(parseInt(limit));

  const result = await pool.query(query, params);

  res.json({
    activity: result.rows,
    count: result.rows.length
  });
}));

/**
 * POST /api/admin/tenants/:id/change-plan
 * Admin-initiated plan change (override, no payment required)
 */
router.post('/tenants/:id/change-plan', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { planId, reason } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  await pool.query('BEGIN');

  try {
    // Get current subscription
    const subResult = await pool.query(
      'SELECT * FROM subscriptions WHERE tenant_id = $1',
      [id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found for tenant' });
    }

    const currentSub = subResult.rows[0];

    // Update subscription
    await pool.query(
      `UPDATE subscriptions
       SET plan_id = $1, updated_at = NOW()
       WHERE tenant_id = $2`,
      [planId, id]
    );

    // Log to subscription history
    await pool.query(
      `INSERT INTO subscription_history
       (subscription_id, old_plan_id, new_plan_id, old_status, new_status, reason, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [currentSub.id, currentSub.plan_id, planId, currentSub.status, currentSub.status,
       `admin_override: ${reason || 'No reason provided'}`, req.adminUserId]
    );

    // Log action
    await pool.query(
      `INSERT INTO audit_logs
       (tenant_id, user_id, event_type, event_category, severity, details, success)
       VALUES ($1, $2, 'PLAN_CHANGED_BY_ADMIN', 'admin', 'high', $3, true)`,
      [id, req.adminUserId, JSON.stringify({
        old_plan_id: currentSub.plan_id,
        new_plan_id: planId,
        reason
      })]
    );

    await pool.query('COMMIT');

    logger.info('Admin changed tenant plan', {
      adminId: req.adminUserId,
      tenantId: id,
      oldPlanId: currentSub.plan_id,
      newPlanId: planId,
      reason
    });

    res.json({
      message: 'Plan changed successfully',
      tenant_id: id,
      new_plan_id: planId
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}));

export default router;
