import { pool } from './src/config/database.js';

async function testApiUsers() {
  try {
    console.log('Simulating GET /api/users?logged_in=true\n');

    // Simulate the exact query from users.js route
    const tenantId = 1; // Assuming tenant 1
    const logged_in = 'true';

    let query = 'SELECT id, email, full_name, role, is_active, last_login_at, created_at FROM users WHERE tenant_id = $1';
    const params = [tenantId];

    // Add the logged_in filter
    if (logged_in === 'true') {
      query += ` AND EXISTS (
        SELECT 1 FROM telegram_contacts tc
        WHERE tc.user_id = users.id
        AND tc.is_logged_in = true
      )`;
    }

    query += ' ORDER BY created_at DESC';

    console.log('Query:', query);
    console.log('Params:', params);
    console.log('');

    const result = await pool.query(query, params);

    console.log('Result count:', result.rows.length);
    console.log('Result:', JSON.stringify(result.rows, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testApiUsers();
