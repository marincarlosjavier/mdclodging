import { pool } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSingleMigration(migrationFile) {
  console.log(`🔄 Running migration: ${migrationFile}...`);

  const filePath = path.join(__dirname, 'migrations', migrationFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`✅ Migration ${migrationFile} completed successfully!`);
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node run-single-migration.js <migration-file.sql>');
  process.exit(1);
}

runSingleMigration(migrationFile).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
