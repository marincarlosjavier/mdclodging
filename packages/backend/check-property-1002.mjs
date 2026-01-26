import pool from './src/config/database.js';

async function checkProperty1002() {
  try {
    const query = `
      SELECT r.id, r.check_in_date, r.check_out_date, r.status, p.name 
      FROM reservations r 
      JOIN properties p ON r.property_id = p.id 
      WHERE p.name LIKE '%1002%' 
      ORDER BY r.check_in_date DESC
    `;
    
    const rows = await pool.query(query);
    console.log(JSON.stringify(rows, null, 2));
    
    // Also get current Colombia time
    const now = new Date();
    const colombiaDate = now.toLocaleString('en-US', { timeZone: 'America/Bogota' });
    console.log('\nFecha actual en Colombia:', colombiaDate);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkProperty1002();
