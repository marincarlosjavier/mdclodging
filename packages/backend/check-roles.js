import { pool } from './src/config/database.js';

async function checkRoles() {
  try {
    const result = await pool.query('SELECT id, email, role FROM users ORDER BY id');

    console.log('\n📋 Usuarios y sus roles:\n');
    result.rows.forEach(u => {
      console.log(`  ${u.id}: ${u.email}`);
      console.log(`     Roles: ${JSON.stringify(u.role)}\n`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRoles();
