import { pool } from './src/config/database.js';

async function fixInconsistentState() {
  try {
    console.log('Fixing reservations with inconsistent state...\n');

    // Find reservations that are NOT checked_out but have actual_checkout_time
    const result = await pool.query(`
      SELECT r.id, r.reference, r.status, r.actual_checkout_time,
             ct.id as task_id, ct.status as task_status
      FROM reservations r
      LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
      WHERE r.status != 'checked_out'
      AND r.actual_checkout_time IS NOT NULL
    `);

    console.log(`Found ${result.rows.length} reservations with inconsistent state:\n`);

    for (const row of result.rows) {
      console.log(`Reservation #${row.id} (${row.reference})`);
      console.log(`  - Status: ${row.status}`);
      console.log(`  - Actual checkout time: ${row.actual_checkout_time} (should be NULL)`);
      console.log(`  - Task ID: ${row.task_id || 'NULL'}`);

      // Clear actual_checkout_time
      await pool.query(
        'UPDATE reservations SET actual_checkout_time = NULL WHERE id = $1',
        [row.id]
      );
      console.log(`  ✓ Cleared actual_checkout_time`);

      // Delete cleaning task if it exists and hasn't been started
      if (row.task_id && row.task_status === 'pending') {
        await pool.query(
          'DELETE FROM cleaning_tasks WHERE id = $1',
          [row.task_id]
        );
        console.log(`  ✓ Deleted cleaning task #${row.task_id}`);
      }

      console.log('');
    }

    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixInconsistentState();
