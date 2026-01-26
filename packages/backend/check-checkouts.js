import { pool } from './src/config/database.js';

(async () => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.check_out_date,
        r.checkout_time,
        r.actual_checkout_time,
        r.status as reservation_status,
        p.name as property_name
      FROM reservations r
      LEFT JOIN properties p ON r.property_id = p.id
      WHERE r.check_out_date = CURRENT_DATE
      ORDER BY r.checkout_time
    `);

    console.log('\nReservaciones con checkout hoy:');
    console.log('Total:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('\n❌ No hay checkouts programados para hoy');
    } else {
      result.rows.forEach(r => {
        console.log(`
ID: ${r.id}
Propiedad: ${r.property_name}
Status: ${r.reservation_status}
Checkout programado: ${r.checkout_time || 'No definido'}
Checkout reportado: ${r.actual_checkout_time || 'NO REPORTADO'}
Puede reportar: ${!r.actual_checkout_time && r.reservation_status === 'active' ? 'SÍ ✓' : 'NO ✗'}
        `);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
