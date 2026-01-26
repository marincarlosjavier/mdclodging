import { pool } from './src/config/database.js';

async function testUsersQuery() {
  try {
    console.log('Testing users query with logged_in filter...\n');

    const query = `SELECT id, email, full_name, role, is_active, last_login_at, created_at
                   FROM users
                   WHERE tenant_id = $1
                   AND EXISTS (
                     SELECT 1 FROM telegram_contacts tc
                     WHERE tc.user_id = users.id
                     AND tc.is_logged_in = true
                   )
                   ORDER BY created_at DESC`;

    const result = await pool.query(query, [1]);

    console.log('Found', result.rows.length, 'logged in users:');
    console.log(JSON.stringify(result.rows, null, 2));

    // Also check telegram_contacts directly
    console.log('\n\nAll telegram_contacts with is_logged_in = true:');
    const tc = await pool.query(
      `SELECT tc.*, u.full_name, u.role
       FROM telegram_contacts tc
       LEFT JOIN users u ON u.id = tc.user_id
       WHERE tc.is_logged_in = true`
    );
    console.log(JSON.stringify(tc.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testUsersQuery();
