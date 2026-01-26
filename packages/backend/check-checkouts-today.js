import { pool } from './src/config/database.js';

const today = new Date().toISOString().split('T')[0];
console.log('Today:', today);

try {
  const result = await pool.query('SELECT id, property_id, check_out_date, status FROM reservations WHERE check_out_date::date = $1', [today]);
  console.log('Check-outs today:', JSON.stringify(result.rows, null, 2));

  // Also check what the frontend gets
  const allRes = await pool.query('SELECT * FROM reservations ORDER BY id');
  console.log('\nAll reservations check_out_date format:');
  allRes.rows.slice(0, 5).forEach(r => {
    console.log(`ID ${r.id}: check_out_date = "${r.check_out_date}", status = "${r.status}"`);
  });
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
