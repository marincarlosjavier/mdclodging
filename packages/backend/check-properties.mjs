import { pool } from './src/config/database.js';

async function checkProperties() {
  try {
    const result = await pool.query(`
      SELECT id, name, is_active, property_type_id
      FROM properties
      ORDER BY id
    `);

    console.log('Total properties:', result.rows.length);
    console.log('\nProperties:');
    result.rows.forEach(p => {
      console.log(`  ID: ${p.id}, Name: ${p.name}, Active: ${p.is_active}`);
    });

    const reservations = await pool.query(`
      SELECT r.id, r.property_id, r.status, r.check_in_date, r.check_out_date, p.name as property_name
      FROM reservations r
      LEFT JOIN properties p ON r.property_id = p.id
      WHERE r.status IN ('active', 'checked_in')
      ORDER BY r.property_id
    `);

    console.log('\nActive/Checked-in Reservations:');
    if (reservations.rows.length === 0) {
      console.log('  None');
    } else {
      reservations.rows.forEach(r => {
        console.log(`  Property: ${r.property_name} (ID: ${r.property_id}), Status: ${r.status}`);
        console.log(`    Check-in: ${r.check_in_date.toISOString().split('T')[0]}, Check-out: ${r.check_out_date.toISOString().split('T')[0]}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProperties();
