import { pool } from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigrations() {
  try {
    console.log('🔄 Aplicando migraciones del sistema de pagos...\n');

    // Migration 019: Add started_at
    console.log('📝 Migration 019: Adding started_at field...');
    const migration019 = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/019_add_started_at_cleaning.sql'),
      'utf8'
    );
    await pool.query(migration019);
    console.log('✅ Migration 019 completada\n');

    // Migration 020: Payment system
    console.log('📝 Migration 020: Creating payment system tables...');
    const migration020 = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/020_cleaning_payments_system.sql'),
      'utf8'
    );
    await pool.query(migration020);
    console.log('✅ Migration 020 completada\n');

    // Verify tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('cleaning_rates', 'cleaning_settlements', 'cleaning_settlement_items', 'cleaning_payments')
      ORDER BY table_name
    `);

    console.log('📋 Tablas creadas:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check started_at column
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cleaning_tasks'
        AND column_name = 'started_at'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('   ✓ cleaning_tasks.started_at');
    }

    console.log('\n✅ Todas las migraciones aplicadas exitosamente');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error aplicando migraciones:', error.message);
    console.error(error);
    process.exit(1);
  }
}

applyMigrations();
