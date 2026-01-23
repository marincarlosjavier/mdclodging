import { pool } from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateTelegramPermissions() {
  try {
    console.log('🔄 Creating Telegram permissions catalog...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'src/database/migrations/017_telegram_permissions_catalog.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully\n');

    // Show catalog
    const catalogResult = await pool.query('SELECT * FROM telegram_permissions_catalog ORDER BY id');
    console.log('📋 Catálogo de Permisos de Telegram:');
    catalogResult.rows.forEach(perm => {
      console.log(`\n  ${perm.id}: ${perm.name} (${perm.code})`);
      console.log(`     ${perm.description}`);
      console.log(`     Permisos: ${JSON.stringify(perm.permissions)}`);
    });

    // Show assignments
    const assignmentsResult = await pool.query(`
      SELECT
        tc.id as contact_id,
        tc.username,
        tc.first_name,
        u.full_name,
        tpc.code as permission_code,
        tpc.name as permission_name
      FROM telegram_contact_permissions tcp
      JOIN telegram_contacts tc ON tc.id = tcp.contact_id
      LEFT JOIN users u ON u.id = tc.user_id
      JOIN telegram_permissions_catalog tpc ON tpc.id = tcp.permission_id
      ORDER BY tc.id, tpc.id
    `);

    console.log('\n\n👥 Asignaciones de Permisos:');
    if (assignmentsResult.rows.length === 0) {
      console.log('  (ninguna asignación todavía)');
    } else {
      const grouped = {};
      assignmentsResult.rows.forEach(row => {
        if (!grouped[row.contact_id]) {
          grouped[row.contact_id] = {
            username: row.username || row.first_name,
            full_name: row.full_name,
            permissions: []
          };
        }
        grouped[row.contact_id].permissions.push(`${row.permission_name} (${row.permission_code})`);
      });

      Object.entries(grouped).forEach(([contactId, data]) => {
        console.log(`\n  ${data.full_name || data.username}:`);
        data.permissions.forEach(p => console.log(`     - ${p}`));
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrateTelegramPermissions();
