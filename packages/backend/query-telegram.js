const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mdclodging'
});

async function run() {
  try {
    const q1 = await pool.query(\);
    console.log('=== USUARIOS HOUSEKEEPING/ADMIN ===');
    console.log(JSON.stringify(q1.rows, null, 2));
    console.log('');
    const q2 = await pool.query(\);
    console.log('=== ESTADO DEL BOT ===');
    console.log(JSON.stringify(q2.rows, null, 2));
  } catch (e) { console.error(e.message); }
  finally { await pool.end(); }
}
run();
