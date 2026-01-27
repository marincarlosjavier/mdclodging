import { pool } from '../config/database.js';
import { updateBusinessMetrics, updateDbPoolMetrics } from '../middleware/metrics.js';
import { logger } from '../config/logger.js';

/**
 * Update Prometheus metrics periodically
 * Run this as a cron job or interval
 */
async function runMetricsUpdate() {
  logger.info('Starting metrics update job');

  try {
    // Update business metrics
    await updateBusinessMetrics(pool);

    // Update database pool metrics
    updateDbPoolMetrics(pool);

    logger.info('Metrics update job completed successfully');
  } catch (error) {
    logger.error('Metrics update job failed', {
      error: error.message,
      stack: error.stack
    });
  }
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runMetricsUpdate()
    .then(() => {
      logger.info('Metrics update complete, exiting');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Metrics update failed', { error: error.message });
      process.exit(1);
    });
}

export default runMetricsUpdate;
