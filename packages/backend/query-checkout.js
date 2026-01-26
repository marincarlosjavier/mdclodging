import { pool } from './src/config/database.js';

const query = `
SELECT
  r.id,
  r.check_out_date,
  r.checkout_time,
  r.actual_checkout_time,
  r.adults,
  r.children,
  r.infants,
  r.status as reservation_status,
  p.name as property_name,
  pt.name as property_type_name,
  ct.id as cleaning_task_id,
  ct.status as cleaning_status,
  ct.checkout_reported_at,
  ct.assigned_to,
  ct.assigned_at,
  ct.started_at,
  ct.completed_at,
  u.full_name as assigned_to_name
FROM reservations r
LEFT JOIN properties p ON r.property_id = p.id
LEFT JOIN property_types pt ON p.property_type_id = pt.id
LEFT JOIN cleaning_tasks ct ON ct.reservation_id = r.id AND ct.task_type = 'check_out'
LEFT JOIN users u ON u.id = ct.assigned_to
WHERE r.check_out_date = CURRENT_DATE
  AND r.status = 'active'
ORDER BY r.checkout_time, r.actual_checkout_time, p.name;
`;

pool.query(query)
  .then(result => {
    console.log('=== RESULTADOS DEL CHECKOUT REPORT ===');
    console.log('Total de registros:', result.rows.length);
    console.log('');
    result.rows.forEach((row, index) => {
      console.log(`--- Registro #${index + 1} ---`);
      Object.keys(row).forEach(key => {
        const value = row[key];
        if (value instanceof Date) {
          console.log(`  ${key}: ${value.toISOString()}`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });
      console.log('');
    });
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
