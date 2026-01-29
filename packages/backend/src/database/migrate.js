import { pool } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Calculate checksum of migration file for integrity verification
 */
function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Ensure schema_migrations table exists
 */
async function ensureMigrationTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      checksum VARCHAR(64)
    );

    CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
    ON schema_migrations(executed_at DESC);
  `;

  await pool.query(createTableSQL);
}

/**
 * Get list of already executed migrations
 */
async function getExecutedMigrations() {
  const result = await pool.query(
    'SELECT version, checksum FROM schema_migrations ORDER BY version'
  );
  return new Map(result.rows.map(row => [row.version, row.checksum]));
}

/**
 * Record a migration as executed
 */
async function recordMigration(version, executionTimeMs, checksum) {
  await pool.query(
    `INSERT INTO schema_migrations (version, executed_at, execution_time_ms, checksum)
     VALUES ($1, NOW(), $2, $3)
     ON CONFLICT (version) DO UPDATE
     SET executed_at = NOW(), execution_time_ms = $2, checksum = $3`,
    [version, executionTimeMs, checksum]
  );
}

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  try {
    // Ensure tracking table exists
    await ensureMigrationTable();

    // Get already executed migrations
    const executedMigrations = await getExecutedMigrations();

    let newMigrations = 0;
    let skippedMigrations = 0;

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = calculateChecksum(sql);

      // Check if already executed
      if (executedMigrations.has(file)) {
        const existingChecksum = executedMigrations.get(file);

        if (existingChecksum === checksum) {
          console.log(`  ⏭️  Skipping ${file} (already executed)`);
          skippedMigrations++;
          continue;
        } else {
          console.warn(`  ⚠️  WARNING: ${file} has changed since last execution!`);
          console.warn(`     Old checksum: ${existingChecksum}`);
          console.warn(`     New checksum: ${checksum}`);
          console.warn(`     Re-running migration...`);
        }
      }

      // Execute new migration
      console.log(`  ➡️  Running ${file}...`);
      const startTime = Date.now();

      await pool.query(sql);

      const executionTime = Date.now() - startTime;

      // Record migration
      await recordMigration(file, executionTime, checksum);

      console.log(`  ✅ ${file} completed (${executionTime}ms)`);
      newMigrations++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Migration summary:`);
    console.log(`   - New migrations executed: ${newMigrations}`);
    console.log(`   - Already executed (skipped): ${skippedMigrations}`);
    console.log(`   - Total migration files: ${files.length}`);
    console.log('='.repeat(60) + '\n');

    if (newMigrations === 0) {
      console.log('✨ Database schema is up to date!\n');
    } else {
      console.log('✅ All new migrations completed successfully!\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
