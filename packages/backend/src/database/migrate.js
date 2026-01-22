import { pool } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  try {
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      console.log(`  ➡️  Running ${file}...`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      await pool.query(sql);
      console.log(`  ✅ ${file} completed`);
    }

    console.log('\n✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
