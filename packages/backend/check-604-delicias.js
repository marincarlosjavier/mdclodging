import { pool } from './src/config/database.js';

async function checkReservations() {
  try {
    const today = '2026-01-25';

    console.log('=== VERIFICANDO RESERVAS 604 Y 402 DELICIAS ===\n');

    const res = await pool.query(`
      SELECT r.id, r.property_id, p.name as property_name, r.status,
             r.check_in_date, r.check_out_date, r.actual_checkin_time
      FROM reservations r
      LEFT JOIN properties p ON p.id = r.property_id
      WHERE r.id IN (17, 16)
      ORDER BY r.id
    `);

    res.rows.forEach(r => {
      const checkIn = r.check_in_date.toISOString().split('T')[0];
      const checkOut = r.check_out_date.toISOString().split('T')[0];

      console.log(`Reserva #${r.id}: ${r.property_name}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Check-in: ${checkIn}`);
      console.log(`  Check-out: ${checkOut}`);
      console.log(`  Actual check-in time: ${r.actual_checkin_time || 'NULL'}`);
      console.log(`  Check-in es hoy? ${checkIn === today}`);
      console.log(`  Check-in es después de hoy? ${checkIn > today}`);
      console.log(`  Check-out es después de hoy? ${checkOut > today}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkReservations();
