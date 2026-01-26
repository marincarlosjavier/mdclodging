import { pool } from './src/config/database.js';

async function fixReservation12() {
  try {
    console.log('Fixing reservation #12 (currently checked_in but has checkout data)...\n');

    // Check current state
    const current = await pool.query(`
      SELECT r.id, r.status, r.actual_checkout_time,
             ct.id as task_id, ct.status as task_status, ct.started_at
      FROM reservations r
      LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
      WHERE r.id = 12
    `);

    if (current.rows.length === 0) {
      console.log('Reservation #12 not found');
      return;
    }

    const res = current.rows[0];
    console.log('Current state:');
    console.log('  - Status:', res.status);
    console.log('  - Actual checkout time:', res.actual_checkout_time || 'NULL');
    console.log('  - Task ID:', res.task_id || 'NULL');
    console.log('  - Task status:', res.task_status || 'NULL');
    console.log('  - Task started at:', res.started_at || 'NULL');
    console.log('');

    // If status is not checked_out, clear the actual_checkout_time
    if (res.status !== 'checked_out' && res.actual_checkout_time) {
      console.log('Status is not checked_out, clearing actual_checkout_time...');
      await pool.query(
        'UPDATE reservations SET actual_checkout_time = NULL WHERE id = 12'
      );
      console.log('✓ Cleared actual_checkout_time');
    }

    // If there's a checkout cleaning task that hasn't been started, delete it
    if (res.task_id && !res.started_at && res.task_status === 'pending') {
      console.log('Deleting unstarted checkout cleaning task...');
      await pool.query(
        'DELETE FROM cleaning_tasks WHERE id = $1',
        [res.task_id]
      );
      console.log('✓ Deleted cleaning task #' + res.task_id);
    }

    console.log('\nDone!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixReservation12();
