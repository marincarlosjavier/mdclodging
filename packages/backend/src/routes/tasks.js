import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireStaff, requireSupervisor } from '../middleware/auth.js';
import { uploadExcel, handleUploadError, deleteFile } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/error.js';
import {
  generateTaskTemplate,
  parseTasksFromExcel,
  importTasks
} from '../services/excel.service.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/tasks
 * List all tasks (filtered by tenant)
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, assigned_to, task_type, priority, location } = req.query;

  let query = 'SELECT * FROM tasks WHERE tenant_id = $1';
  const params = [req.tenantId];
  let paramCount = 1;

  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    params.push(status);
  }

  if (assigned_to) {
    paramCount++;
    query += ` AND assigned_to = $${paramCount}`;
    params.push(assigned_to);
  }

  if (task_type) {
    paramCount++;
    query += ` AND task_type = $${paramCount}`;
    params.push(task_type);
  }

  if (priority) {
    paramCount++;
    query += ` AND priority = $${paramCount}`;
    params.push(priority);
  }

  if (location) {
    paramCount++;
    query += ` AND location ILIKE $${paramCount}`;
    params.push(`%${location}%`);
  }

  query += ' ORDER BY priority DESC, due_date ASC, created_at DESC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/tasks/:id
 * Get single task with photos
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const taskResult = await pool.query(
    `SELECT t.*,
            u_assigned.full_name as assigned_to_name,
            u_created.full_name as created_by_name
     FROM tasks t
     LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN users u_created ON u_created.id = t.created_by
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [id, req.tenantId]
  );

  if (taskResult.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Get photos
  const photosResult = await pool.query(
    `SELECT * FROM task_photos WHERE task_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
    [id, req.tenantId]
  );

  res.json({
    ...taskResult.rows[0],
    photos: photosResult.rows
  });
}));

/**
 * POST /api/tasks
 * Create new task (Method 1: JSON API)
 */
router.post('/', requireSupervisor, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    task_type,
    location,
    room_number,
    priority,
    assigned_to,
    due_date,
    estimated_duration,
    notes
  } = req.body;

  // Validation
  if (!title || !task_type || !location || !priority) {
    return res.status(400).json({
      error: 'Missing required fields: title, task_type, location, priority'
    });
  }

  // Validate assigned_to user exists and belongs to same tenant
  if (assigned_to) {
    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true',
      [assigned_to, req.tenantId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid assigned user' });
    }
  }

  const result = await pool.query(
    `INSERT INTO tasks (
      tenant_id, title, description, task_type, location, room_number,
      priority, assigned_to, created_by, due_date, estimated_duration, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      req.tenantId,
      title,
      description,
      task_type,
      location,
      room_number,
      priority,
      assigned_to,
      req.user.id,
      due_date,
      estimated_duration,
      notes
    ]
  );

  // Log to history
  await pool.query(
    `INSERT INTO task_history (tenant_id, task_id, changed_by, change_type, new_value)
     VALUES ($1, $2, $3, $4, $5)`,
    [req.tenantId, result.rows[0].id, req.user.id, 'created', JSON.stringify(result.rows[0])]
  );

  res.status(201).json(result.rows[0]);
}));

/**
 * GET /api/tasks/template
 * Download Excel template for task import (Method 2: Excel)
 */
router.get('/template', requireSupervisor, asyncHandler(async (req, res) => {
  const workbook = await generateTaskTemplate();

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=tasks_template.xlsx'
  );

  await workbook.xlsx.write(res);
  res.end();
}));

/**
 * POST /api/tasks/import-excel
 * Import tasks from Excel file (Method 2: Excel)
 */
router.post(
  '/import-excel',
  requireSupervisor,
  uploadExcel.single('file'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    try {
      // Parse Excel file
      const { tasks, errors } = await parseTasksFromExcel(
        req.file.path,
        req.tenantId,
        req.user.id
      );

      if (errors.length > 0 && tasks.length === 0) {
        deleteFile(req.file.path);
        return res.status(400).json({
          error: 'All rows have validation errors',
          errors
        });
      }

      // Import valid tasks
      const results = await importTasks(tasks, req.tenantId, req.user.id);

      // Delete uploaded file
      deleteFile(req.file.path);

      res.json({
        message: 'Import completed',
        total_rows: tasks.length + errors.length,
        validation_errors: errors.length,
        imported: results.success,
        failed: results.failed,
        errors: [...errors, ...results.errors]
      });

    } catch (error) {
      deleteFile(req.file.path);
      throw error;
    }
  })
);

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    status,
    priority,
    task_type,
    location,
    room_number,
    assigned_to,
    due_date,
    estimated_duration,
    notes
  } = req.body;

  // Get current task
  const current = await pool.query(
    'SELECT * FROM tasks WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const result = await pool.query(
    `UPDATE tasks SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      status = COALESCE($3, status),
      priority = COALESCE($4, priority),
      task_type = COALESCE($5, task_type),
      location = COALESCE($6, location),
      room_number = COALESCE($7, room_number),
      assigned_to = COALESCE($8, assigned_to),
      due_date = COALESCE($9, due_date),
      estimated_duration = COALESCE($10, estimated_duration),
      notes = COALESCE($11, notes),
      updated_at = NOW()
    WHERE id = $12 AND tenant_id = $13
    RETURNING *`,
    [
      title, description, status, priority, task_type, location,
      room_number, assigned_to, due_date, estimated_duration, notes,
      id, req.tenantId
    ]
  );

  // Log change
  await pool.query(
    `INSERT INTO task_history (tenant_id, task_id, changed_by, change_type, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      req.tenantId,
      id,
      req.user.id,
      'updated',
      JSON.stringify(current.rows[0]),
      JSON.stringify(result.rows[0])
    ]
  );

  res.json(result.rows[0]);
}));

/**
 * PATCH /api/tasks/:id/status
 * Update task status (for workers via Telegram)
 */
router.patch('/:id/status', requireStaff, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const result = await pool.query(
    `UPDATE tasks SET
      status = $1,
      started_at = CASE WHEN $1 = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
      completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
    WHERE id = $2 AND tenant_id = $3
    RETURNING *`,
    [status, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', requireSupervisor, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM tasks WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ message: 'Task deleted successfully' });
}));

/**
 * GET /api/tasks/:id/history
 * Get task history/audit trail
 */
router.get('/:id/history', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT th.*, u.full_name as changed_by_name
     FROM task_history th
     JOIN users u ON u.id = th.changed_by
     WHERE th.task_id = $1 AND th.tenant_id = $2
     ORDER BY th.created_at DESC`,
    [id, req.tenantId]
  );

  res.json(result.rows);
}));

export default router;
