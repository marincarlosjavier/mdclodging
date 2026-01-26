import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();
router.use(authenticate);

// GET /api/cleaning-tasks - List all cleaning tasks with filters
router.get('/', asyncHandler(async (req, res) => {
  const { property_id, task_type, status, date, assigned_to } = req.query;

  let query = `
    SELECT ct.*,
      p.name as property_name,
      pt.name as property_type_name,
      r.check_in_date, r.check_out_date,
      u.full_name as assigned_to_name,
      uc.full_name as completed_by_name
    FROM cleaning_tasks ct
    LEFT JOIN properties p ON ct.property_id = p.id
    LEFT JOIN property_types pt ON p.property_type_id = pt.id
    LEFT JOIN reservations r ON ct.reservation_id = r.id
    LEFT JOIN users u ON ct.assigned_to = u.id
    LEFT JOIN users uc ON ct.completed_by = uc.id
    WHERE ct.tenant_id = $1
  `;

  const params = [req.tenantId];
  let paramCount = 1;

  if (property_id) {
    paramCount++;
    query += ` AND ct.property_id = $${paramCount}`;
    params.push(property_id);
  }

  if (task_type) {
    paramCount++;
    query += ` AND ct.task_type = $${paramCount}`;
    params.push(task_type);
  }

  if (status) {
    paramCount++;
    query += ` AND ct.status = $${paramCount}`;
    params.push(status);
  }

  if (date) {
    paramCount++;
    query += ` AND ct.scheduled_date = $${paramCount}`;
    params.push(date);
  }

  if (assigned_to) {
    paramCount++;
    query += ` AND ct.assigned_to = $${paramCount}`;
    params.push(assigned_to);
  }

  query += ' ORDER BY ct.scheduled_date ASC, ct.created_at DESC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/cleaning-tasks/today - Get today's tasks
router.get('/today', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT ct.*,
       p.name as property_name,
       pt.name as property_type_name,
       u.full_name as assigned_to_name
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON ct.property_id = p.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     LEFT JOIN users u ON ct.assigned_to = u.id
     WHERE ct.tenant_id = $1
       AND ct.scheduled_date = $2
       AND ct.status != 'cancelled'
     ORDER BY ct.task_type, p.name`,
    [req.tenantId, today]
  );

  // Group by task type
  const grouped = {
    check_out: result.rows.filter(t => t.task_type === 'check_out'),
    stay_over: result.rows.filter(t => t.task_type === 'stay_over'),
    deep_cleaning: result.rows.filter(t => t.task_type === 'deep_cleaning')
  };

  res.json({
    date: today,
    total: result.rows.length,
    tasks: result.rows,
    grouped
  });
}));

// GET /api/cleaning-tasks/:id - Get single task
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT ct.*,
       p.name as property_name,
       pt.name as property_type_name,
       r.check_in_date, r.check_out_date,
       r.adults, r.children, r.infants,
       u.full_name as assigned_to_name,
       uc.full_name as completed_by_name
     FROM cleaning_tasks ct
     LEFT JOIN properties p ON ct.property_id = p.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     LEFT JOIN reservations r ON ct.reservation_id = r.id
     LEFT JOIN users u ON ct.assigned_to = u.id
     LEFT JOIN users uc ON ct.completed_by = uc.id
     WHERE ct.id = $1 AND ct.tenant_id = $2`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Cleaning task not found' });
  }

  res.json(result.rows[0]);
}));

// POST /api/cleaning-tasks - Create manual cleaning task (e.g., deep cleaning)
router.post('/', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const {
    property_id,
    task_type,
    scheduled_date,
    assigned_to,
    notes
  } = req.body;

  if (!property_id || !task_type || !scheduled_date) {
    return res.status(400).json({ error: 'property_id, task_type, and scheduled_date are required' });
  }

  const result = await pool.query(
    `INSERT INTO cleaning_tasks (tenant_id, property_id, task_type, scheduled_date, assigned_to, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [req.tenantId, property_id, task_type, scheduled_date, assigned_to, notes]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/cleaning-tasks/:id - Update task
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    scheduled_date,
    assigned_to,
    status,
    notes
  } = req.body;

  const result = await pool.query(
    `UPDATE cleaning_tasks
     SET scheduled_date = COALESCE($1, scheduled_date),
         assigned_to = COALESCE($2, assigned_to),
         status = COALESCE($3, status),
         notes = COALESCE($4, notes),
         updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [scheduled_date, assigned_to, status, notes, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Cleaning task not found' });
  }

  res.json(result.rows[0]);
}));

// PATCH /api/cleaning-tasks/:id/complete - Mark task as completed
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE cleaning_tasks
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
           completed_by = $1,
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [req.user.id, notes, id, req.tenantId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cleaning task not found' });
    }

    const task = result.rows[0];

    // Update property cleaning counter based on task type
    if (task.task_type === 'check_out') {
      // Increment counter for regular check_out
      await client.query(
        'UPDATE properties SET cleaning_count = cleaning_count + 1 WHERE id = $1',
        [task.property_id]
      );
    } else if (task.task_type === 'deep_cleaning') {
      // Reset counter for deep_cleaning
      await client.query(
        'UPDATE properties SET cleaning_count = 0 WHERE id = $1',
        [task.property_id]
      );
    }
    // stay_over tasks don't affect the counter

    await client.query('COMMIT');
    res.json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// PATCH /api/cleaning-tasks/:id/start - Mark task as in progress
router.patch('/:id/start', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE cleaning_tasks
     SET status = 'in_progress',
         assigned_to = COALESCE(assigned_to, $1),
         assigned_at = COALESCE(assigned_at, CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
         updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'UTC'
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [req.user.id, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Cleaning task not found' });
  }

  res.json(result.rows[0]);
}));

// DELETE /api/cleaning-tasks/:id - Delete/cancel task
router.delete('/:id', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE cleaning_tasks
     SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Cleaning task not found' });
  }

  res.json({ message: 'Cleaning task cancelled successfully' });
}));

// PUT /api/cleaning-tasks/:id/start - Start a cleaning task
router.put('/:id/start', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;

  const now = new Date();
  const assignedAt = assigned_to ? now : null;

  const result = await pool.query(
    `UPDATE cleaning_tasks
     SET status = 'in_progress',
         assigned_to = $1::INTEGER,
         assigned_at = $2,
         started_at = $3,
         updated_at = $4
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [assigned_to || null, assignedAt, now, now, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Cleaning task not found' });
  }

  res.json(result.rows[0]);
}));

// PUT /api/cleaning-tasks/:id/complete - Complete a cleaning task
router.put('/:id/complete', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const now = new Date();

    const result = await client.query(
      `UPDATE cleaning_tasks
       SET status = 'completed',
           completed_at = $1,
           completed_by = $2,
           updated_at = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [now, req.userId, now, id, req.tenantId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cleaning task not found' });
    }

    const task = result.rows[0];

    // Note: We don't update the reservation status when completing cleaning
    // The reservation stays as 'checked_out' - only the cleaning_task is marked as completed

    // Update property cleaning counter based on task type
    if (task.task_type === 'check_out') {
      // Increment counter for regular check_out
      await client.query(
        'UPDATE properties SET cleaning_count = cleaning_count + 1 WHERE id = $1',
        [task.property_id]
      );
    } else if (task.task_type === 'deep_cleaning') {
      // Reset counter for deep_cleaning
      await client.query(
        'UPDATE properties SET cleaning_count = 0 WHERE id = $1',
        [task.property_id]
      );
    }
    // stay_over tasks don't affect the counter

    await client.query('COMMIT');
    res.json(task);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
