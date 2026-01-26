import { pool } from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateToMultipleRoles() {
  try {
    console.log('🔄 Migrating users table to support multiple roles...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/015_multiple_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully\n');

    // Verify data
    const result = await pool.query('SELECT id, email, role FROM users ORDER BY id LIMIT 10');

    console.log('📊 Current users and their roles:');
    result.rows.forEach(user => {
      console.log(`  ${user.email}: ${JSON.stringify(user.role)}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateToMultipleRoles();
