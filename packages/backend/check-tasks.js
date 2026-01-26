const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mdc_lodging'
});

async function runQueries() {
  try {
    console.log('=== TAREAS DE LIMPIEZA (ÚLTIMOS 2 DÍAS) ===\n');
    const tasks = await pool.query(`
      SELECT 
        ct.id,
        ct.status,
        ct.assigned_to,
        ct.assigned_at,
        ct.started_at,
        ct.completed_at,
        ct.checkout_reported_at,
        ct.is_priority,
        p.name as property_name,
        u.full_name as assigned_to_name
      FROM cleaning_tasks ct
      LEFT JOIN properties p ON p.id = ct.property_id
      LEFT JOIN users u ON u.id = ct.assigned_to
      WHERE ct.task_type = 'check_out'
        AND ct.scheduled_date >= CURRENT_DATE - INTERVAL '2 days'
      ORDER BY ct.id DESC
      LIMIT 5
    `);
    
    console.log('Resultados encontrados:', tasks.rows.length);
    tasks.rows.forEach(row => {
      console.log('\n---');
      console.log('ID:', row.id);
      console.log('Propiedad:', row.property_name);
      console.log('Status:', row.status);
      console.log('Asignado a:', row.assigned_to_name || 'Sin asignar');
      console.log('Asignado en:', row.assigned_at);
      console.log('Iniciado en:', row.started_at);
      console.log('Completado en:', row.completed_at);
      console.log('Checkout reportado en:', row.checkout_reported_at);
      console.log('Es prioritario:', row.is_priority);
    });

    console.log('\n\n=== RESERVAS CON CHECKOUT HOY ===\n');
    const reservations = await pool.query(`
      SELECT 
        r.id,
        r.checkout_time,
        r.actual_checkout_time,
        p.name as property_name
      FROM reservations r
      JOIN properties p ON r.property_id = p.id
      WHERE r.check_out_date = CURRENT_DATE
        AND r.status = 'active'
    `);
    
    console.log('Resultados encontrados:', reservations.rows.length);
    reservations.rows.forEach(row => {
      console.log('\n---');
      console.log('ID:', row.id);
      console.log('Propiedad:', row.property_name);
      console.log('Hora checkout programada:', row.checkout_time);
      console.log('Hora checkout real:', row.actual_checkout_time);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runQueries();
