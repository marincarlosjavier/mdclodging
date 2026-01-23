import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();
router.use(authenticate);

// =====================================================
// CLEANING RATES (Admin only)
// =====================================================

// GET /api/cleaning-settlements/rates - Get all rates
router.get('/rates', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT cr.*, pt.name as property_type_name
     FROM cleaning_rates cr
     LEFT JOIN property_types pt ON pt.id = cr.property_type_id
     WHERE cr.tenant_id = $1
     ORDER BY pt.name, cr.task_type`,
    [req.tenantId]
  );

  res.json(result.rows);
}));

// POST /api/cleaning-settlements/rates - Create or update rate
router.post('/rates', requireRole('admin'), asyncHandler(async (req, res) => {
  const { property_type_id, task_type, rate } = req.body;

  if (!property_type_id || !task_type || rate === undefined) {
    return res.status(400).json({ error: 'property_type_id, task_type, and rate are required' });
  }

  // Upsert: Insert or update if exists
  const result = await pool.query(
    `INSERT INTO cleaning_rates (tenant_id, property_type_id, task_type, rate)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id, property_type_id, task_type)
     DO UPDATE SET rate = $4, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [req.tenantId, property_type_id, task_type, rate]
  );

  res.json(result.rows[0]);
}));

// DELETE /api/cleaning-settlements/rates/:id - Delete rate
router.delete('/rates/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM cleaning_rates WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Rate not found' });
  }

  res.json({ message: 'Rate deleted successfully' });
}));

// =====================================================
// SETTLEMENTS
// =====================================================

// GET /api/cleaning-settlements - List settlements (Admin: all, Staff: own)
router.get('/', asyncHandler(async (req, res) => {
  const { status, user_id, from_date, to_date } = req.query;
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
  const isAdmin = userRoles.some(role => ['admin', 'supervisor'].includes(role));

  let query = `
    SELECT cs.*,
      u.full_name as user_name,
      reviewer.full_name as reviewer_name,
      (SELECT COUNT(*) FROM cleaning_settlement_items WHERE settlement_id = cs.id) as items_count
    FROM cleaning_settlements cs
    LEFT JOIN users u ON u.id = cs.user_id
    LEFT JOIN users reviewer ON reviewer.id = cs.reviewed_by
    WHERE cs.tenant_id = $1
  `;

  const params = [req.tenantId];
  let paramCount = 1;

  // Si no es admin, solo puede ver sus propias liquidaciones
  if (!isAdmin) {
    paramCount++;
    query += ` AND cs.user_id = $${paramCount}`;
    params.push(req.user.id);
  } else if (user_id) {
    // Si es admin y especifica user_id
    paramCount++;
    query += ` AND cs.user_id = $${paramCount}`;
    params.push(user_id);
  }

  if (status) {
    paramCount++;
    query += ` AND cs.status = $${paramCount}`;
    params.push(status);
  }

  if (from_date) {
    paramCount++;
    query += ` AND cs.settlement_date >= $${paramCount}`;
    params.push(from_date);
  }

  if (to_date) {
    paramCount++;
    query += ` AND cs.settlement_date <= $${paramCount}`;
    params.push(to_date);
  }

  query += ' ORDER BY cs.settlement_date DESC, cs.created_at DESC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/cleaning-settlements/:id - Get settlement details with items
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
  const isAdmin = userRoles.some(role => ['admin', 'supervisor'].includes(role));

  // Get settlement
  let settlementQuery = `
    SELECT cs.*,
      u.full_name as user_name,
      u.email as user_email,
      reviewer.full_name as reviewer_name
    FROM cleaning_settlements cs
    LEFT JOIN users u ON u.id = cs.user_id
    LEFT JOIN users reviewer ON reviewer.id = cs.reviewed_by
    WHERE cs.id = $1 AND cs.tenant_id = $2
  `;

  const settlementParams = [id, req.tenantId];

  // Si no es admin, solo puede ver sus propias liquidaciones
  if (!isAdmin) {
    settlementQuery += ' AND cs.user_id = $3';
    settlementParams.push(req.user.id);
  }

  const settlementResult = await pool.query(settlementQuery, settlementParams);

  if (settlementResult.rows.length === 0) {
    return res.status(404).json({ error: 'Settlement not found' });
  }

  const settlement = settlementResult.rows[0];

  // Get items
  const itemsResult = await pool.query(
    `SELECT csi.*,
       ct.checkout_reported_at,
       p.name as current_property_name
     FROM cleaning_settlement_items csi
     LEFT JOIN cleaning_tasks ct ON ct.id = csi.cleaning_task_id
     LEFT JOIN properties p ON p.id = ct.property_id
     WHERE csi.settlement_id = $1
     ORDER BY csi.completed_at`,
    [id]
  );

  // Get payments
  const paymentsResult = await pool.query(
    `SELECT cp.*, u.full_name as paid_by_name
     FROM cleaning_payments cp
     LEFT JOIN users u ON u.id = cp.paid_by
     WHERE cp.settlement_id = $1
     ORDER BY cp.payment_date DESC`,
    [id]
  );

  settlement.items = itemsResult.rows;
  settlement.payments = paymentsResult.rows;
  settlement.total_paid = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  settlement.pending_amount = parseFloat(settlement.total_amount) - settlement.total_paid;

  res.json(settlement);
}));

// POST /api/cleaning-settlements/create-draft - Create draft settlement for today
router.post('/create-draft', asyncHandler(async (req, res) => {
  const { settlement_date } = req.body;
  const targetDate = settlement_date || new Date().toISOString().split('T')[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if settlement already exists
    const existingCheck = await client.query(
      'SELECT id, status FROM cleaning_settlements WHERE tenant_id = $1 AND user_id = $2 AND settlement_date = $3',
      [req.tenantId, req.user.id, targetDate]
    );

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Settlement already exists for this date',
        settlement_id: existingCheck.rows[0].id,
        status: existingCheck.rows[0].status
      });
    }

    // Get completed tasks for this user on this date (not yet in any settlement)
    const tasksResult = await client.query(
      `SELECT ct.*, p.name as property_name, pt.name as property_type_name, pt.id as property_type_id
       FROM cleaning_tasks ct
       LEFT JOIN properties p ON p.id = ct.property_id
       LEFT JOIN property_types pt ON pt.id = p.property_type_id
       WHERE ct.tenant_id = $1
         AND ct.assigned_to = $2
         AND ct.status = 'completed'
         AND DATE(ct.completed_at) = $3
         AND ct.id NOT IN (SELECT cleaning_task_id FROM cleaning_settlement_items)
       ORDER BY ct.completed_at`,
      [req.tenantId, req.user.id, targetDate]
    );

    if (tasksResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No completed tasks found for this date' });
    }

    // Get rates for all property types
    const ratesResult = await client.query(
      'SELECT * FROM cleaning_rates WHERE tenant_id = $1',
      [req.tenantId]
    );

    const ratesMap = {};
    ratesResult.rows.forEach(rate => {
      const key = `${rate.property_type_id}_${rate.task_type}`;
      ratesMap[key] = parseFloat(rate.rate);
    });

    // Calculate totals
    let totalAmount = 0;
    const itemsData = [];

    for (const task of tasksResult.rows) {
      const key = `${task.property_type_id}_${task.task_type}`;
      const rate = ratesMap[key] || 0;

      // Calculate work duration
      let workDurationMinutes = null;
      if (task.started_at && task.completed_at) {
        const start = new Date(task.started_at);
        const end = new Date(task.completed_at);
        workDurationMinutes = Math.round((end - start) / 60000);
      }

      totalAmount += rate;
      itemsData.push({
        cleaning_task_id: task.id,
        property_name: task.property_name,
        property_type_name: task.property_type_name,
        task_type: task.task_type,
        rate: rate,
        started_at: task.started_at,
        completed_at: task.completed_at,
        work_duration_minutes: workDurationMinutes
      });
    }

    // Create settlement
    const settlementResult = await client.query(
      `INSERT INTO cleaning_settlements (tenant_id, user_id, settlement_date, total_tasks, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *`,
      [req.tenantId, req.user.id, targetDate, tasksResult.rows.length, totalAmount]
    );

    const settlement = settlementResult.rows[0];

    // Insert items
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO cleaning_settlement_items (
          settlement_id, cleaning_task_id, property_name, property_type_name,
          task_type, rate, started_at, completed_at, work_duration_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          settlement.id, item.cleaning_task_id, item.property_name, item.property_type_name,
          item.task_type, item.rate, item.started_at, item.completed_at, item.work_duration_minutes
        ]
      );
    }

    await client.query('COMMIT');

    // Fetch complete settlement data
    const completeResult = await pool.query(
      `SELECT cs.*, u.full_name as user_name
       FROM cleaning_settlements cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.id = $1`,
      [settlement.id]
    );

    res.json(completeResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// PUT /api/cleaning-settlements/:id/submit - Submit settlement for approval
router.put('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `UPDATE cleaning_settlements
     SET status = 'submitted',
         submitted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status = 'draft'
     RETURNING *`,
    [id, req.tenantId, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Settlement not found or cannot be submitted' });
  }

  res.json(result.rows[0]);
}));

// PUT /api/cleaning-settlements/:id/approve - Approve settlement (Admin only)
router.put('/:id/approve', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const result = await pool.query(
    `UPDATE cleaning_settlements
     SET status = 'approved',
         reviewed_by = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         review_notes = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND tenant_id = $4 AND status = 'submitted'
     RETURNING *`,
    [req.user.id, notes, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Settlement not found or cannot be approved' });
  }

  res.json(result.rows[0]);
}));

// PUT /api/cleaning-settlements/:id/reject - Reject settlement (Admin only)
router.put('/:id/reject', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  if (!notes) {
    return res.status(400).json({ error: 'Rejection notes are required' });
  }

  const result = await pool.query(
    `UPDATE cleaning_settlements
     SET status = 'rejected',
         reviewed_by = $1,
         reviewed_at = CURRENT_TIMESTAMP,
         review_notes = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND tenant_id = $4 AND status = 'submitted'
     RETURNING *`,
    [req.user.id, notes, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Settlement not found or cannot be rejected' });
  }

  res.json(result.rows[0]);
}));

// POST /api/cleaning-settlements/:id/payments - Register payment (Admin only)
router.post('/:id/payments', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, payment_date, payment_method, reference_number, notes } = req.body;

  if (!amount || !payment_date) {
    return res.status(400).json({ error: 'amount and payment_date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify settlement exists and is approved
    const settlementCheck = await client.query(
      'SELECT * FROM cleaning_settlements WHERE id = $1 AND tenant_id = $2 AND status = $3',
      [id, req.tenantId, 'approved']
    );

    if (settlementCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Settlement not found or not approved' });
    }

    const settlement = settlementCheck.rows[0];

    // Check total paid so far
    const paymentsCheck = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total_paid FROM cleaning_payments WHERE settlement_id = $1',
      [id]
    );

    const totalPaid = parseFloat(paymentsCheck.rows[0].total_paid);
    const pendingAmount = parseFloat(settlement.total_amount) - totalPaid;

    if (parseFloat(amount) > pendingAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Payment amount exceeds pending amount',
        pending_amount: pendingAmount
      });
    }

    // Register payment
    const paymentResult = await client.query(
      `INSERT INTO cleaning_payments (
        settlement_id, amount, payment_date, payment_method,
        reference_number, notes, paid_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [id, amount, payment_date, payment_method, reference_number, notes, req.user.id]
    );

    // Check if fully paid
    const newTotalPaid = totalPaid + parseFloat(amount);
    if (newTotalPaid >= parseFloat(settlement.total_amount)) {
      await client.query(
        'UPDATE cleaning_settlements SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['paid', id]
      );
    }

    await client.query('COMMIT');

    res.json(paymentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// DELETE /api/cleaning-settlements/:id - Delete draft settlement
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM cleaning_settlements WHERE id = $1 AND tenant_id = $2 AND user_id = $3 AND status = $4 RETURNING id',
    [id, req.tenantId, req.user.id, 'draft']
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Settlement not found or cannot be deleted' });
  }

  res.json({ message: 'Settlement deleted successfully' });
}));

export default router;
