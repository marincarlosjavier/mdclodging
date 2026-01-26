import { pool } from './src/config/database.js';

async function cleanupDuplicateCodes() {
  try {
    console.log('🧹 Limpiando códigos duplicados...\n');

    // Find duplicate codes for each user
    const duplicatesResult = await pool.query(`
      SELECT user_id, tenant_id, COUNT(*) as count
      FROM telegram_link_codes
      WHERE used = false AND expires_at > NOW()
      GROUP BY user_id, tenant_id
      HAVING COUNT(*) > 1
    `);

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No hay códigos duplicados');
      await pool.end();
      process.exit(0);
    }

    console.log(`⚠️  Encontrados ${duplicatesResult.rows.length} usuarios con códigos duplicados:\n`);

    for (const dup of duplicatesResult.rows) {
      const { user_id, tenant_id, count } = dup;

      // Get user info
      const userResult = await pool.query(
        'SELECT full_name, email FROM users WHERE id = $1',
        [user_id]
      );
      const user = userResult.rows[0];

      console.log(`Usuario: ${user.full_name} (${user.email}) - ${count} códigos`);

      // Get all codes for this user
      const codesResult = await pool.query(
        `SELECT id, code, created_at FROM telegram_link_codes
         WHERE user_id = $1 AND tenant_id = $2 AND used = false AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [user_id, tenant_id]
      );

      // Keep the most recent code, delete the rest
      const [mostRecent, ...toDelete] = codesResult.rows;

      console.log(`  Manteniendo: ${mostRecent.code} (${new Date(mostRecent.created_at).toLocaleString()})`);

      for (const code of toDelete) {
        await pool.query('DELETE FROM telegram_link_codes WHERE id = $1', [code.id]);
        console.log(`  ❌ Eliminado: ${code.code} (${new Date(code.created_at).toLocaleString()})`);
      }

      console.log('');
    }

    console.log('✅ Limpieza completada');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicateCodes();
