import { pool } from './src/config/database.js';

async function setTelegramLogin() {
  try {
    console.log('Setting telegram user as logged in...\n');

    // Update María Housekeeping to logged in
    const result = await pool.query(
      `UPDATE telegram_contacts
       SET is_logged_in = true, last_login_at = NOW()
       WHERE telegram_id = '6175529816'
       RETURNING *`
    );

    if (result.rows.length > 0) {
      console.log('✓ User updated:');
      console.log('  Telegram ID:', result.rows[0].telegram_id);
      console.log('  User ID:', result.rows[0].user_id);
      console.log('  Is Logged In:', result.rows[0].is_logged_in);
      console.log('  Last Login:', result.rows[0].last_login_at);
    } else {
      console.log('✗ No user found with that telegram_id');
    }

    // Show all users with telegram
    console.log('\nAll telegram users:');
    const all = await pool.query(
      `SELECT u.full_name, tc.telegram_id, tc.is_logged_in, tc.last_login_at
       FROM telegram_contacts tc
       JOIN users u ON u.id = tc.user_id
       ORDER BY u.id`
    );

    all.rows.forEach(row => {
      console.log(`  - ${row.full_name}: ${row.is_logged_in ? '✓ Logged in' : '✗ Not logged in'}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

setTelegramLogin();
