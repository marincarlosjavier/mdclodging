import { pool } from './src/config/database.js';

async function testEspCheckoutFilter() {
  try {
    console.log('Testing "Esp. Check out" filter query...\n');

    const tenantId = 1;
    const targetDate = '2026-01-25';

    const whereClause = `r.tenant_id = $1 AND r.status IN ('active', 'checked_in', 'checked_out') AND r.check_out_date = $2 AND r.actual_checkout_time IS NULL`;

    const result = await pool.query(
      `SELECT
        r.id,
        r.check_out_date,
        r.reference,
        r.status as reservation_status,
        COALESCE(r.checkout_time, '12:00') as checkout_time,
        r.actual_checkout_time,
        r.adults,
        r.children,
        r.infants,
        p.name as property_name,
        pt.name as property_type_name,
        ct.id as cleaning_task_id,
        ct.task_type as cleaning_task_type,
        ct.status as cleaning_status,
        ct.checkout_reported_at,
        ct.assigned_to,
        ct.assigned_at,
        ct.started_at,
        ct.completed_at,
        u.full_name as assigned_to_name
       FROM reservations r
       LEFT JOIN properties p ON r.property_id = p.id
       LEFT JOIN property_types pt ON p.property_type_id = pt.id
       LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
       LEFT JOIN users u ON u.id = ct.assigned_to
       WHERE ${whereClause}
       ORDER BY
         CASE WHEN ct.status = 'completed' THEN 1 ELSE 0 END,
         r.check_out_date,
         COALESCE(r.checkout_time, '12:00'),
         r.actual_checkout_time,
         p.name`,
      [tenantId, targetDate]
    );

    console.log(`Found ${result.rows.length} reservations waiting for checkout:\n`);

    result.rows.forEach((row, index) => {
      console.log(`--- Reservation ${index + 1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`Reference: ${row.reference}`);
      console.log(`Property: ${row.property_name}`);
      console.log(`Reservation Status: ${row.reservation_status}`);
      console.log(`Checkout Date: ${row.check_out_date}`);
      console.log(`Checkout Time: ${row.checkout_time}`);
      console.log(`Actual Checkout Time: ${row.actual_checkout_time || 'NULL'}`);
      console.log(`Cleaning Task ID: ${row.cleaning_task_id || 'NULL'}`);
      console.log(`Cleaning Status: ${row.cleaning_status || 'NULL'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testEspCheckoutFilter();
