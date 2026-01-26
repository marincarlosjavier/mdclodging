import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkCheckoutData() {
  try {
    const query = `
      SELECT
        r.id,
        r.reference,
        r.status as reservation_status,
        r.check_out_date,
        r.checkout_time,
        r.actual_checkout_time,
        p.name as property_name,
        ct.id as cleaning_task_id,
        ct.status as cleaning_status,
        ct.assigned_at,
        ct.started_at,
        ct.completed_at
      FROM reservations r
      LEFT JOIN properties p ON r.property_id = p.id
      LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
      WHERE r.check_out_date = '2026-01-25' OR r.id = 12
      ORDER BY r.id
    `;

    const result = await pool.query(query);

    console.log('\n=== Checkout Report Data for 2026-01-25 ===\n');
    console.log('Found ' + result.rows.length + ' checkouts for today\n');

    result.rows.forEach((row, index) => {
      console.log('--- Checkout ' + (index + 1) + ' ---');
      console.log('Reservation ID: ' + row.id);
      console.log('Reference: ' + row.reference);
      console.log('Reservation Status: ' + row.reservation_status);
      console.log('Property: ' + row.property_name);
      console.log('Checkout Time: ' + row.checkout_time);
      console.log('Actual Checkout Time: ' + row.actual_checkout_time);
      console.log('Cleaning Task ID: ' + row.cleaning_task_id);
      console.log('Cleaning Status: ' + row.cleaning_status);
      console.log('Assigned At: ' + row.assigned_at);
      console.log('Started At: ' + row.started_at);
      console.log('Completed At: ' + row.completed_at);

      // Determine which filter it should match
      if (!row.cleaning_task_id) {
        console.log('=> NO CLEANING TASK - Won\'t show in any filter');
      } else if (row.cleaning_status === 'pending' && !row.actual_checkout_time) {
        console.log('=> Should match: waiting_checkout (Esp. Checkout)');
      } else if (row.cleaning_status === 'pending' && row.actual_checkout_time && !row.started_at) {
        console.log('=> Should match: checked_out (Checked Out)');
      } else if (row.cleaning_status === 'in_progress') {
        console.log('=> Should match: in_progress (En Progreso)');
      } else if (row.cleaning_status === 'completed') {
        console.log('=> Should match: completed (Completados)');
      } else {
        console.log('=> UNKNOWN STATE');
      }
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCheckoutData();
