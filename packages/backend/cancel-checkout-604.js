import { pool } from './src/config/database.js';

async function cancelCheckout604() {
  try {
    console.log('Cancelando checkout de la propiedad 604 (Reserva #12)...\n');

    // Check current state
    const current = await pool.query(`
      SELECT r.id, r.status, r.actual_checkout_time,
             ct.id as task_id, ct.status as task_status, ct.started_at
      FROM reservations r
      LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
      WHERE r.id = 12
    `);

    if (current.rows.length === 0) {
      console.log('Reserva #12 no encontrada');
      return;
    }

    const res = current.rows[0];
    console.log('Estado actual:');
    console.log('  - Status:', res.status);
    console.log('  - Actual checkout time:', res.actual_checkout_time || 'NULL');
    console.log('  - Task ID:', res.task_id || 'NULL');
    console.log('  - Task status:', res.task_status || 'NULL');
    console.log('');

    // Clear actual_checkout_time
    console.log('Limpiando actual_checkout_time...');
    await pool.query(
      'UPDATE reservations SET actual_checkout_time = NULL, status = $1 WHERE id = 12',
      ['checked_in']
    );
    console.log('✓ actual_checkout_time = NULL');
    console.log('✓ status = checked_in');

    // Delete cleaning task if it exists and hasn't been started
    if (res.task_id && !res.started_at) {
      console.log('Eliminando tarea de limpieza...');
      await pool.query(
        'DELETE FROM cleaning_tasks WHERE id = $1',
        [res.task_id]
      );
      console.log('✓ Tarea de limpieza eliminada');
    } else if (res.task_id && res.started_at) {
      console.log('⚠ La tarea ya fue iniciada, no se puede eliminar');
    }

    console.log('\nResultado:');
    console.log('✓ La propiedad 604 ahora aparecerá en "Esp. Check out"');
    console.log('  (checkout programado para hoy, esperando que se reporte)');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

cancelCheckout604();
