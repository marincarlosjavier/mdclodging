import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Validate environment variables before proceeding
import { validateEnvironment } from './config/validateEnv.js';
validateEnvironment();

// Import after validation to ensure config is valid
import app from './app.js';
import { pool } from './config/database.js';
import { startTelegramBot } from './telegram/bot.js';
import updateMetrics from './jobs/updateMetrics.js';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('   Make sure PostgreSQL is running and credentials are correct.');
    process.exit(1);
  }

  console.log('✅ Database connected successfully');
  console.log(`   Time: ${res.rows[0].now}`);
});

// Start Telegram bot if enabled
async function initializeTelegramBot() {
  try {
    // Check if any tenant has bot enabled
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM system_settings
       WHERE setting_key = 'telegram_bot_enabled'
       AND setting_value = 'true'`
    );

    if (rows[0].count > 0) {
      await startTelegramBot();
      console.log('✅ Telegram bot initialized');
    } else {
      console.log('ℹ️  Telegram bot not enabled (configure in admin panel)');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Telegram bot:', error.message);
    console.error('   Bot can be enabled later from admin panel');
  }
}

// Start server
const server = app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🏨 MDCLodging - Hotel Management System');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log('='.repeat(60) + '\n');

  // Initialize Telegram bot after server starts
  initializeTelegramBot();

  // Update metrics every 30 seconds
  const metricsInterval = setInterval(() => {
    updateMetrics().catch(err => {
      console.error('Error updating metrics:', err.message);
    });
  }, 30000);

  // Initial metrics update
  updateMetrics();

  // Store interval for cleanup
  server.metricsInterval = metricsInterval;
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');

  // Clear metrics interval
  if (server.metricsInterval) {
    clearInterval(server.metricsInterval);
  }

  server.close(() => {
    console.log('✅ HTTP server closed');

    pool.end(() => {
      console.log('✅ Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT signal received: closing HTTP server');

  // Clear metrics interval
  if (server.metricsInterval) {
    clearInterval(server.metricsInterval);
  }

  server.close(() => {
    console.log('✅ HTTP server closed');

    pool.end(() => {
      console.log('✅ Database pool closed');
      process.exit(0);
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default server;
