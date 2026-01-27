import promClient from 'prom-client';
import { logger } from '../config/logger.js';

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop lag, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'mdclodging_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

/**
 * HTTP Request Duration Histogram
 * Tracks response time for all HTTP requests
 */
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5, 10],
  registers: [register]
});

/**
 * HTTP Request Counter
 * Counts total HTTP requests
 */
export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  registers: [register]
});

/**
 * HTTP Errors Counter
 * Counts HTTP errors by type
 */
export const httpErrorsTotal = new promClient.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
  registers: [register]
});

/**
 * Active Tasks Gauge
 * Current number of active cleaning tasks by status
 */
export const activeTasksGauge = new promClient.Gauge({
  name: 'mdclodging_active_tasks',
  help: 'Number of active cleaning tasks',
  labelNames: ['status', 'tenant_id'],
  registers: [register]
});

/**
 * Active Users Gauge
 * Current number of active users per tenant
 */
export const activeUsersGauge = new promClient.Gauge({
  name: 'mdclodging_active_users',
  help: 'Number of active users',
  labelNames: ['tenant_id'],
  registers: [register]
});

/**
 * Subscription Status Gauge
 * Current subscription counts by status
 */
export const subscriptionStatusGauge = new promClient.Gauge({
  name: 'mdclodging_subscriptions',
  help: 'Number of subscriptions by status',
  labelNames: ['status', 'plan'],
  registers: [register]
});

/**
 * Revenue Gauge
 * Monthly recurring revenue in COP
 */
export const mrrGauge = new promClient.Gauge({
  name: 'mdclodging_mrr_cop',
  help: 'Monthly recurring revenue in Colombian Pesos',
  registers: [register]
});

/**
 * Quota Violations Counter
 * Counts quota violations by type
 */
export const quotaViolationsTotal = new promClient.Counter({
  name: 'mdclodging_quota_violations_total',
  help: 'Total number of quota violations',
  labelNames: ['quota_type', 'tenant_id'],
  registers: [register]
});

/**
 * Database Query Duration Histogram
 * Tracks database query performance
 */
export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register]
});

/**
 * Database Connection Pool Gauge
 * Current database pool statistics
 */
export const dbPoolGauge = new promClient.Gauge({
  name: 'db_pool_connections',
  help: 'Database connection pool statistics',
  labelNames: ['state'],  // idle, total, waiting
  registers: [register]
});

/**
 * Authentication Events Counter
 * Tracks login attempts and outcomes
 */
export const authEventsTotal = new promClient.Counter({
  name: 'mdclodging_auth_events_total',
  help: 'Total authentication events',
  labelNames: ['event_type', 'success'],  // login, logout, password_reset
  registers: [register]
});

/**
 * Stripe Events Counter
 * Tracks Stripe webhook events
 */
export const stripeEventsTotal = new promClient.Counter({
  name: 'mdclodging_stripe_events_total',
  help: 'Total Stripe webhook events',
  labelNames: ['event_type', 'success'],
  registers: [register]
});

/**
 * Telegram Bot Events Counter
 * Tracks Telegram bot activity
 */
export const telegramEventsTotal = new promClient.Counter({
  name: 'mdclodging_telegram_events_total',
  help: 'Total Telegram bot events',
  labelNames: ['event_type'],
  registers: [register]
});

/**
 * Middleware to track HTTP metrics
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // Track when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const tenantId = req.tenantId?.toString() || 'unknown';

    // Record duration
    httpRequestDuration.observe({
      method: req.method,
      route: route,
      status_code: res.statusCode,
      tenant_id: tenantId
    }, duration);

    // Count request
    httpRequestTotal.inc({
      method: req.method,
      route: route,
      status_code: res.statusCode,
      tenant_id: tenantId
    });

    // Count errors (4xx and 5xx)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      httpErrorsTotal.inc({
        method: req.method,
        route: route,
        status_code: res.statusCode,
        error_type: errorType
      });
    }
  });

  next();
}

/**
 * Metrics endpoint handler
 * Returns Prometheus metrics in text format
 */
export async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics', { error: error.message });
    res.status(500).end('Error generating metrics');
  }
}

/**
 * Update business metrics periodically
 * Should be called by a cron job or interval
 */
export async function updateBusinessMetrics(pool) {
  try {
    // Update subscription status metrics
    const subscriptions = await pool.query(`
      SELECT s.status, sp.name as plan, COUNT(*) as count
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE s.status IN ('active', 'trialing', 'past_due', 'canceled')
      GROUP BY s.status, sp.name
    `);

    // Reset and set subscription gauges
    subscriptionStatusGauge.reset();
    for (const row of subscriptions.rows) {
      subscriptionStatusGauge.set(
        { status: row.status, plan: row.plan },
        parseInt(row.count)
      );
    }

    // Update MRR
    const mrrResult = await pool.query(`
      SELECT COALESCE(SUM(sp.price_monthly_cop), 0) as mrr
      FROM subscriptions s
      JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE s.status IN ('active', 'trialing')
    `);
    mrrGauge.set(parseInt(mrrResult.rows[0].mrr));

    // Update active tasks by status
    const tasks = await pool.query(`
      SELECT status, tenant_id, COUNT(*) as count
      FROM cleaning_tasks
      WHERE status IN ('pending', 'in_progress', 'completed')
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY status, tenant_id
    `);

    activeTasksGauge.reset();
    for (const row of tasks.rows) {
      activeTasksGauge.set(
        { status: row.status, tenant_id: row.tenant_id.toString() },
        parseInt(row.count)
      );
    }

    // Update active users per tenant
    const users = await pool.query(`
      SELECT tenant_id, COUNT(*) as count
      FROM users
      WHERE is_active = true
      GROUP BY tenant_id
    `);

    activeUsersGauge.reset();
    for (const row of users.rows) {
      activeUsersGauge.set(
        { tenant_id: row.tenant_id.toString() },
        parseInt(row.count)
      );
    }

    logger.debug('Business metrics updated');
  } catch (error) {
    logger.error('Error updating business metrics', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Update database pool metrics
 */
export function updateDbPoolMetrics(pool) {
  try {
    // Get pool statistics
    const totalCount = pool.totalCount || 0;
    const idleCount = pool.idleCount || 0;
    const waitingCount = pool.waitingCount || 0;

    dbPoolGauge.set({ state: 'total' }, totalCount);
    dbPoolGauge.set({ state: 'idle' }, idleCount);
    dbPoolGauge.set({ state: 'waiting' }, waitingCount);
  } catch (error) {
    logger.error('Error updating DB pool metrics', { error: error.message });
  }
}

// Export the registry for testing
export { register };
