import ExcelJS from 'exceljs';
import { pool } from '../config/database.js';
import path from 'path';

/**
 * Generate Excel template for task import
 */
export async function generateTaskTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tasks');

  // Define columns
  worksheet.columns = [
    { header: 'Título *', key: 'title', width: 30 },
    { header: 'Descripción', key: 'description', width: 40 },
    { header: 'Tipo *', key: 'task_type', width: 15 },
    { header: 'Ubicación *', key: 'location', width: 20 },
    { header: 'Habitación', key: 'room_number', width: 15 },
    { header: 'Prioridad *', key: 'priority', width: 15 },
    { header: 'Asignado a (email)', key: 'assigned_to', width: 25 },
    { header: 'Fecha vencimiento', key: 'due_date', width: 20 },
    { header: 'Duración estimada (min)', key: 'estimated_duration', width: 20 },
    { header: 'Notas', key: 'notes', width: 30 }
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };

  // Add sample data
  worksheet.addRow({
    title: 'Limpieza habitación 101',
    description: 'Limpieza profunda después de check-out',
    task_type: 'cleaning',
    location: 'Piso 1',
    room_number: '101',
    priority: 'high',
    assigned_to: 'maria@demo.com',
    due_date: '2024-01-25 14:00',
    estimated_duration: '30',
    notes: 'Revisar minibar'
  });

  worksheet.addRow({
    title: 'Reparar aire acondicionado',
    description: 'No enfría correctamente',
    task_type: 'maintenance',
    location: 'Piso 2',
    room_number: '205',
    priority: 'urgent',
    assigned_to: 'carlos@demo.com',
    due_date: '2024-01-25 10:00',
    estimated_duration: '60',
    notes: ''
  });

  // Add instructions sheet
  const instructionsSheet = workbook.addWorksheet('Instrucciones');
  instructionsSheet.columns = [
    { header: 'Campo', key: 'field', width: 30 },
    { header: 'Descripción', key: 'description', width: 50 },
    { header: 'Valores permitidos', key: 'values', width: 40 }
  ];

  instructionsSheet.getRow(1).font = { bold: true };

  const instructions = [
    { field: 'Título *', description: 'Título de la tarea (obligatorio)', values: 'Texto libre' },
    { field: 'Descripción', description: 'Descripción detallada de la tarea', values: 'Texto libre' },
    { field: 'Tipo *', description: 'Tipo de tarea (obligatorio)', values: 'cleaning, maintenance, inspection, other' },
    { field: 'Ubicación *', description: 'Ubicación general (obligatorio)', values: 'Texto libre (ej: Piso 1, Lobby)' },
    { field: 'Habitación', description: 'Número de habitación específica', values: 'Texto/número libre' },
    { field: 'Prioridad *', description: 'Nivel de prioridad (obligatorio)', values: 'low, medium, high, urgent' },
    { field: 'Asignado a', description: 'Email del usuario asignado', values: 'Email válido del sistema' },
    { field: 'Fecha vencimiento', description: 'Fecha y hora límite', values: 'YYYY-MM-DD HH:MM o DD/MM/YYYY HH:MM' },
    { field: 'Duración estimada', description: 'Tiempo estimado en minutos', values: 'Número (ej: 30, 60, 120)' },
    { field: 'Notas', description: 'Notas adicionales', values: 'Texto libre' }
  ];

  instructionsSheet.addRows(instructions);

  return workbook;
}

/**
 * Parse and validate Excel file for task import
 */
export async function parseTasksFromExcel(filePath, tenantId, createdBy) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet('Tasks') || workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const tasks = [];
  const errors = [];

  // Skip header row
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const rowData = {
      title: row.getCell(1).value,
      description: row.getCell(2).value,
      task_type: row.getCell(3).value,
      location: row.getCell(4).value,
      room_number: row.getCell(5).value,
      priority: row.getCell(6).value,
      assigned_to_email: row.getCell(7).value,
      due_date: row.getCell(8).value,
      estimated_duration: row.getCell(9).value,
      notes: row.getCell(10).value
    };

    // Skip empty rows
    if (!rowData.title && !rowData.task_type) return;

    // Validate required fields
    const rowErrors = [];

    if (!rowData.title) rowErrors.push('Título es obligatorio');
    if (!rowData.task_type) rowErrors.push('Tipo es obligatorio');
    if (!rowData.location) rowErrors.push('Ubicación es obligatoria');
    if (!rowData.priority) rowErrors.push('Prioridad es obligatoria');

    // Validate enums
    const validTypes = ['cleaning', 'maintenance', 'inspection', 'other'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];

    if (rowData.task_type && !validTypes.includes(rowData.task_type.toLowerCase())) {
      rowErrors.push(`Tipo inválido. Valores permitidos: ${validTypes.join(', ')}`);
    }

    if (rowData.priority && !validPriorities.includes(rowData.priority.toLowerCase())) {
      rowErrors.push(`Prioridad inválida. Valores permitidos: ${validPriorities.join(', ')}`);
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        errors: rowErrors,
        data: rowData
      });
    } else {
      tasks.push({
        ...rowData,
        task_type: rowData.task_type.toLowerCase(),
        priority: rowData.priority.toLowerCase(),
        row: rowNumber
      });
    }
  });

  return { tasks, errors };
}

/**
 * Import tasks from parsed data
 */
export async function importTasks(tasks, tenantId, createdBy) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const task of tasks) {
      try {
        // Resolve assigned user if email provided
        let assignedToId = null;
        if (task.assigned_to_email) {
          const userResult = await client.query(
            'SELECT id FROM users WHERE tenant_id = $1 AND email = $2 AND is_active = true',
            [tenantId, task.assigned_to_email]
          );

          if (userResult.rows.length > 0) {
            assignedToId = userResult.rows[0].id;
          } else {
            throw new Error(`Usuario no encontrado: ${task.assigned_to_email}`);
          }
        }

        // Parse due date
        let dueDate = null;
        if (task.due_date) {
          dueDate = new Date(task.due_date);
          if (isNaN(dueDate.getTime())) {
            throw new Error('Fecha de vencimiento inválida');
          }
        }

        // Insert task
        await client.query(
          `INSERT INTO tasks (
            tenant_id, title, description, task_type, location, room_number,
            priority, assigned_to, created_by, due_date, estimated_duration, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tenantId,
            task.title,
            task.description,
            task.task_type,
            task.location,
            task.room_number,
            task.priority,
            assignedToId,
            createdBy,
            dueDate,
            task.estimated_duration ? parseInt(task.estimated_duration) : null,
            task.notes
          ]
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: task.row,
          title: task.title,
          error: error.message
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return results;
}
