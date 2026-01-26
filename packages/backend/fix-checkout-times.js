import { pool } from './src/config/database.js';

async function fixCheckoutTimes() {
  try {
    console.log('Fixing checkout times - subtracting 5 hours from UTC times to get Colombia times...\n');

    // Get all checked_out reservations with actual_checkout_time
    const result = await pool.query(
      `SELECT id, property_id, actual_checkout_time
       FROM reservations
       WHERE status = 'checked_out'
       AND actual_checkout_time IS NOT NULL
       ORDER BY id`
    );

    console.log(`Found ${result.rows.length} checked out reservations with times:\n`);

    for (const row of result.rows) {
      const oldTime = row.actual_checkout_time;
      console.log(`Property ${row.property_id} - Old time: ${oldTime}`);

      // Subtract 5 hours from the time
      const [hours, minutes, seconds] = oldTime.split(':');
      let newHours = parseInt(hours) - 5;

      // Handle negative hours (wrap to previous day)
      if (newHours < 0) {
        newHours += 24;
      }

      const newTime = `${String(newHours).padStart(2, '0')}:${minutes}:${seconds}`;
      console.log(`Property ${row.property_id} - New time: ${newTime}`);

      // Update the record
      await pool.query(
        'UPDATE reservations SET actual_checkout_time = $1 WHERE id = $2',
        [newTime, row.id]
      );

      console.log(`✓ Updated reservation ${row.id}\n`);
    }

    console.log('Done! All checkout times have been corrected to Colombia timezone.');

  } catch (error) {
    console.error('Error fixing checkout times:', error);
  } finally {
    await pool.end();
  }
}

fixCheckoutTimes();
