import { pool } from './src/config/database.js';

const today = new Date().toISOString().split('T')[0];
console.log('Today:', today);

try {
  const result = await pool.query('SELECT id, property_id, check_in_date, status FROM reservations WHERE check_in_date::date = $1', [today]);
  console.log('\nCheck-ins today:', JSON.stringify(result.rows, null, 2));

  const activeCheckins = await pool.query('SELECT id, property_id, check_in_date, status FROM reservations WHERE check_in_date::date = $1 AND status = $2', [today, 'active']);
  console.log('\nCheck-ins today (active only):', JSON.stringify(activeCheckins.rows, null, 2));

  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
