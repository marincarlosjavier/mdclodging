import { pool } from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateTelegramRoles() {
  try {
    console.log('🔄 Adding telegram_roles to telegram_contacts table...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/016_telegram_roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully\n');

    // Verify data
    const result = await pool.query(`
      SELECT tc.id, tc.username, tc.first_name, tc.is_active, tc.telegram_roles,
             u.full_name, u.role as system_role
      FROM telegram_contacts tc
      LEFT JOIN users u ON u.id = tc.user_id
      ORDER BY tc.id
    `);

    console.log('📊 Current telegram contacts and their roles:');
    result.rows.forEach(contact => {
      console.log(`\n  ID: ${contact.id}`);
      console.log(`  Telegram: @${contact.username || contact.first_name}`);
      console.log(`  User: ${contact.full_name || 'Not linked'}`);
      console.log(`  Active: ${contact.is_active}`);
      console.log(`  System roles: ${JSON.stringify(contact.system_role)}`);
      console.log(`  Telegram roles: ${JSON.stringify(contact.telegram_roles)}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateTelegramRoles();
