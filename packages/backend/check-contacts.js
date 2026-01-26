import { pool } from './src/config/database.js';

async function checkContacts() {
  try {
    // Check link codes
    const codesResult = await pool.query(
      `SELECT lc.*, u.full_name, u.email
       FROM telegram_link_codes lc
       JOIN users u ON u.id = lc.user_id
       WHERE lc.used = false
       ORDER BY lc.created_at DESC`
    );

    console.log('\n=== Códigos Activos ===');
    if (codesResult.rows.length === 0) {
      console.log('No hay códigos activos');
    } else {
      codesResult.rows.forEach(code => {
        console.log(`Código: ${code.code} - Usuario: ${code.full_name} (${code.email})`);
      });
    }

    // Check contacts
    const contactsResult = await pool.query(
      `SELECT tc.*, u.full_name, u.email, u.role
       FROM telegram_contacts tc
       LEFT JOIN users u ON u.id = tc.user_id
       ORDER BY tc.created_at DESC`
    );

    console.log('\n=== Contactos Telegram ===');
    if (contactsResult.rows.length === 0) {
      console.log('No hay contactos');
    } else {
      contactsResult.rows.forEach(contact => {
        console.log(`ID: ${contact.id}`);
        console.log(`  Telegram: @${contact.username || contact.first_name}`);
        console.log(`  Usuario: ${contact.full_name || 'No vinculado'}`);
        console.log(`  Vinculado: ${contact.linked_at ? 'Sí' : 'No'}`);
        console.log(`  Activo: ${contact.is_active}`);
        console.log('');
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkContacts();
