import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkProperty402() {
  try {
    console.log('=== PROPIEDAD 402 ===\n');

    // Get property info
    const { rows: propRows } = await pool.query(
      'SELECT id, name, cleaning_count FROM properties WHERE name = $1',
      ['402']
    );
    const property = propRows[0];
    console.log(`ID: ${property.id}`);
    console.log(`Nombre: ${property.name}`);
    console.log(`Contador actual (cleaning_count): ${property.cleaning_count}`);

    // Get tenant interval
    const { rows: tenantRows } = await pool.query(
      'SELECT deep_cleaning_interval FROM tenants WHERE id = 1'
    );
    const interval = tenantRows[0]?.deep_cleaning_interval || 11;
    console.log(`Intervalo de deep cleaning: Cada ${interval} check-outs\n`);

    // Get today's cleaning task for 402
    const today = new Date().toISOString().split('T')[0];
    const { rows: taskRows } = await pool.query(
      `SELECT ct.id, ct.task_type, ct.status, ct.assigned_to, r.id as reservation_id
       FROM cleaning_tasks ct
       JOIN reservations r ON r.id = ct.reservation_id
       WHERE ct.property_id = $1
         AND ct.scheduled_date = $2
         AND ct.status != 'cancelled'
       ORDER BY ct.id`,
      [property.id, today]
    );

    console.log('Tareas de limpieza para hoy:');
    if (taskRows.length === 0) {
      console.log('  No hay tareas programadas para hoy');
    } else {
      taskRows.forEach(task => {
        console.log(`  - Tarea ID ${task.id} (Reserva #${task.reservation_id}): ${task.task_type} - Estado: ${task.status}`);
      });
    }

    // Calculate what happens after completion
    console.log(`\n=== QUE PASARA AL COMPLETAR ===`);
    const todayTask = taskRows[0];
    if (todayTask) {
      console.log(`Tarea de hoy: ${todayTask.task_type}`);

      if (todayTask.task_type === 'check_out') {
        const newCount = property.cleaning_count + 1;
        console.log(`✓ Al completar: cleaning_count se incrementara a ${newCount}`);

        if (newCount >= interval) {
          console.log(`⚠️  NOTA: La proxima reserva tendra una tarea de DEEP_CLEANING`);
        } else {
          console.log(`✓ La proxima reserva tendra una tarea de check_out normal (${newCount}/${interval})`);
        }
      } else if (todayTask.task_type === 'deep_cleaning') {
        console.log(`✓ Al completar: cleaning_count se reseteara a 0`);
        console.log(`✓ La proxima reserva empezara el contador de nuevo (1/${interval})`);
      } else if (todayTask.task_type === 'stay_over') {
        console.log(`✓ Al completar: cleaning_count NO cambia (se mantiene en ${property.cleaning_count})`);
        console.log(`✓ Las tareas stay_over no afectan el contador`);
      }
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProperty402();
