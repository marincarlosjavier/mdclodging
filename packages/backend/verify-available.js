import { pool } from './src/config/database.js';

async function verifyAvailable() {
  try {
    const today = '2026-01-25';

    console.log('=== VERIFICANDO DISPONIBILIDAD HOY (2026-01-25) ===\n');

    const res = await pool.query(`
      SELECT r.id, r.property_id, p.name as property_name, r.status,
             r.check_in_date, r.check_out_date
      FROM reservations r
      LEFT JOIN properties p ON p.id = r.property_id
      WHERE r.status IN ('active', 'checked_in')
      ORDER BY r.property_id
    `);

    console.log('Propiedades totales: 7');
    console.log('(604, 802, 402, 1002, 502, 402 delicias, 402C)\n');

    const occupiedIds = new Set();

    console.log('Reservas activas/checked_in:');
    res.rows.forEach(r => {
      const checkIn = r.check_in_date.toISOString().split('T')[0];
      const checkOut = r.check_out_date.toISOString().split('T')[0];
      const isOccupiedToday = checkIn <= today && checkOut > today;

      console.log(`\n  Reserva #${r.id}: ${r.property_name} (${r.property_id})`);
      console.log(`    Check-in: ${checkIn}, Check-out: ${checkOut}`);
      console.log(`    Check-in <= hoy? ${checkIn <= today}`);
      console.log(`    Checkout > hoy? ${checkOut > today}`);
      console.log(`    Ocupada HOY? ${isOccupiedToday ? 'SÍ' : 'NO'}`);

      if (isOccupiedToday) {
        occupiedIds.add(r.property_id);
      }
    });

    console.log('\n=== RESUMEN ===');
    console.log('Propiedades OCUPADAS hoy:', Array.from(occupiedIds));
    console.log('Total ocupadas:', occupiedIds.size);

    const allPropertyIds = [1, 2, 3, 4, 5, 7, 8]; // 604, 802, 402, 1002, 502, 402 delicias, 402C
    const availableIds = allPropertyIds.filter(id => !occupiedIds.has(id));
    const propertyNames = {
      1: '604',
      2: '802',
      3: '402',
      4: '1002',
      5: '502',
      7: '402 delicias',
      8: '402C'
    };

    console.log('\nPropiedades DISPONIBLES hoy:', availableIds.map(id => propertyNames[id]));
    console.log('Total disponibles:', availableIds.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyAvailable();
