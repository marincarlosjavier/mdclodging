import { pool } from './src/config/database.js';

const today = new Date().toISOString().split('T')[0];
console.log('Today:', today);

try {
  // All reservations
  const allRes = await pool.query('SELECT id, property_id, check_in_date, check_out_date, status, has_breakfast, adults, children FROM reservations ORDER BY id');

  console.log('\n=== ALL RESERVATIONS ===');
  allRes.rows.forEach(r => {
    const checkIn = r.check_in_date.toISOString().split('T')[0];
    const checkOut = r.check_out_date.toISOString().split('T')[0];
    console.log(`ID ${r.id}: ${checkIn} → ${checkOut}, status: ${r.status}, breakfast: ${r.has_breakfast}`);
  });

  // Check-ins today
  const checkins = await pool.query('SELECT id FROM reservations WHERE check_in_date::date = $1 AND status = $2', [today, 'active']);
  console.log(`\n✓ Check-ins today (active): ${checkins.rows.length}`);

  // Check-outs today
  const checkouts = await pool.query('SELECT id FROM reservations WHERE check_out_date::date = $1 AND status IN ($2, $3)', [today, 'active', 'checked_in']);
  console.log(`✓ Check-outs today (active/checked_in): ${checkouts.rows.length}`);

  // Stayovers
  const stayovers = await pool.query('SELECT id FROM reservations WHERE check_in_date::date < $1 AND check_out_date::date > $1 AND status IN ($2, $3)', [today, 'active', 'checked_in']);
  console.log(`✓ Stayovers: ${stayovers.rows.length}`);

  // Breakfasts
  const breakfasts = await pool.query('SELECT adults, children FROM reservations WHERE has_breakfast = true AND status IN ($1, $2)', ['active', 'checked_in']);
  const breakfastCount = breakfasts.rows.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0);
  console.log(`✓ Breakfasts (guests): ${breakfastCount}`);

  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
