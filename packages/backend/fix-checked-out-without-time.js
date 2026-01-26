import { pool } from './src/config/database.js';

async function fixCheckedOutWithoutTime() {
  try {
    console.log('Fixing reservations with status=checked_out but no actual_checkout_time...\n');

    // Find reservations with checked_out status but no actual_checkout_time
    const result = await pool.query(`
      SELECT id, property_id, reference, check_out_date, checkout_time
      FROM reservations
      WHERE status = 'checked_out'
      AND actual_checkout_time IS NULL
    `);

    console.log(`Found ${result.rows.length} reservations to fix:\n`);

    for (const row of result.rows) {
      console.log(`Reservation #${row.id} (${row.reference || 'No reference'})`);
      console.log(`  - Check out date: ${row.check_out_date}`);
      console.log(`  - Expected checkout time: ${row.checkout_time}`);

      // Use the checkout_time from the reservation (default 12:00)
      const checkoutTime = row.checkout_time || '12:00:00';

      // Update the reservation
      await pool.query(
        'UPDATE reservations SET actual_checkout_time = $1 WHERE id = $2',
        [checkoutTime, row.id]
      );

      console.log(`  - Set actual_checkout_time to: ${checkoutTime}`);

      // Check if cleaning task exists
      const taskCheck = await pool.query(
        `SELECT id, status FROM cleaning_tasks
         WHERE reservation_id = $1 AND task_type = 'check_out'`,
        [row.id]
      );

      if (taskCheck.rows.length > 0) {
        const task = taskCheck.rows[0];
        console.log(`  - Cleaning task #${task.id} already exists with status: ${task.status}`);

        // Update the cleaning task to set checkout_reported_at if it's pending
        if (task.status === 'pending') {
          await pool.query(
            `UPDATE cleaning_tasks
             SET checkout_reported_at = CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota'
             WHERE id = $1`,
            [task.id]
          );
          console.log(`  - Updated checkout_reported_at on cleaning task`);
        }
      } else {
        console.log(`  - No cleaning task found (will be created on next backend update)`);
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

fixCheckedOutWithoutTime();
