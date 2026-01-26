import { pool } from './src/config/database.js';

try {
  const result = await pool.query('SELECT DISTINCT task_type FROM cleaning_tasks ORDER BY task_type');
  console.log('Task types in database:');
  result.rows.forEach(r => {
    console.log(`  - ${r.task_type}`);
  });

  // Also check from reservations table
  const res2 = await pool.query(`
    SELECT DISTINCT ct.task_type, r.check_in_date, r.check_out_date
    FROM cleaning_tasks ct
    JOIN reservations r ON ct.reservation_id = r.id
    ORDER BY ct.task_type
    LIMIT 10
  `);
  console.log('\nSample tasks with dates:');
  res2.rows.forEach(r => {
    console.log(`  - ${r.task_type}: ${r.check_in_date?.toISOString().split('T')[0]} → ${r.check_out_date?.toISOString().split('T')[0]}`);
  });

  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
