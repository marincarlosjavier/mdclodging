const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mdclodging'
});

async function checkBotStatus() {
  try {
    const query = ;
    
    const result = await pool.query(query);
    
    console.log('\n=== ESTADO DEL BOT DE TELEGRAM ===');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBotStatus();
