import { pool } from './src/config/database.js';

async function checkPermissions() {
  try {
    console.log('=== PERMISOS DE TELEGRAM DISPONIBLES ===\n');

    const result = await pool.query(`
      SELECT id, code, name, description, is_active
      FROM telegram_permissions_catalog
      ORDER BY id
    `);

    result.rows.forEach(p => {
      console.log(`${p.code}:`);
      console.log(`  Nombre: ${p.name}`);
      console.log(`  Descripción: ${p.description || 'N/A'}`);
      console.log(`  Activo: ${p.is_active}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkPermissions();
