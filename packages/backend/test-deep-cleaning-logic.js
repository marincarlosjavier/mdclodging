import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testNewLogic() {
  try {
    console.log('=== Testing New Deep Cleaning Logic ===\n');

    // Get all properties with their cleaning counts
    const { rows } = await pool.query(
      'SELECT id, name, cleaning_count FROM properties ORDER BY id'
    );

    console.log('Current property cleaning counts:');
    rows.forEach(p => {
      console.log(`  Property ${p.id} (${p.name}): ${p.cleaning_count} completed check_outs`);
    });

    // Get tenant deep_cleaning_interval
    const { rows: tenantRows } = await pool.query(
      'SELECT deep_cleaning_interval FROM tenants WHERE id = 1'
    );
    const interval = tenantRows[0]?.deep_cleaning_interval || 11;
    console.log(`\nDeep cleaning interval: Every ${interval} check_outs\n`);

    // Show next task type for each property
    console.log('Next cleaning task type for each property:');
    rows.forEach(p => {
      const nextCount = p.cleaning_count + 1;
      const willBeDeepCleaning = nextCount >= interval;
      const taskType = willBeDeepCleaning ? 'DEEP_CLEANING (will reset counter)' : `check_out (count will be ${nextCount})`;
      console.log(`  Property ${p.id} (${p.name}): ${taskType}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testNewLogic();
