import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();
router.use(authenticate);

// Helper function to generate cleaning tasks for a reservation
async function generateCleaningTasks(client, reservation, tenantId, stayOverInterval) {
  const tasks = [];
  const checkInDate = new Date(reservation.check_in_date);
  const checkOutDate = new Date(reservation.check_out_date);

  // 1. Generate check-out cleaning task (on checkout date)
  tasks.push({
    type: 'check_out',
    date: checkOutDate
  });

  // 2. Generate stay-over cleaning tasks (every X days during stay)
  const daysDiff = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  if (daysDiff > stayOverInterval) {
    let currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + stayOverInterval);

    while (currentDate < checkOutDate) {
      tasks.push({
        type: 'stay_over',
        date: new Date(currentDate)
      });
      currentDate.setDate(currentDate.getDate() + stayOverInterval);
    }
  }

  // Insert all tasks
  for (const task of tasks) {
    await client.query(
      `INSERT INTO cleaning_tasks (tenant_id, property_id, reservation_id, task_type, scheduled_date, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [tenantId, reservation.property_id, reservation.id, task.type, task.date]
    );
  }

  return tasks.length;
}

// GET /api/reservations - List all reservations with filters
router.get('/', asyncHandler(async (req, res) => {
  const { property_id, status, from_date, to_date } = req.query;

  let query = `
    SELECT r.*,
      p.name as property_name,
      pt.name as property_type_name,
      (r.adults + r.children + r.infants) as total_guests
    FROM reservations r
    LEFT JOIN properties p ON r.property_id = p.id
    LEFT JOIN property_types pt ON p.property_type_id = pt.id
    WHERE r.tenant_id = $1
  `;

  const params = [req.tenantId];
  let paramCount = 1;

  if (property_id) {
    paramCount++;
    query += ` AND r.property_id = $${paramCount}`;
    params.push(property_id);
  }

  if (status) {
    paramCount++;
    query += ` AND r.status = $${paramCount}`;
    params.push(status);
  }

  if (from_date) {
    paramCount++;
    query += ` AND r.check_out_date >= $${paramCount}`;
    params.push(from_date);
  }

  if (to_date) {
    paramCount++;
    query += ` AND r.check_in_date <= $${paramCount}`;
    params.push(to_date);
  }

  query += ' ORDER BY r.check_in_date DESC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/reservations/breakfast-list - Get today's breakfast list
router.get('/breakfast-list', asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT r.id, r.adults, r.children, r.infants,
       (r.adults + r.children) as breakfast_count,
       p.name as property_name,
       pt.name as property_type_name
     FROM reservations r
     LEFT JOIN properties p ON r.property_id = p.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     WHERE r.tenant_id = $1
       AND r.status = 'active'
       AND r.has_breakfast = true
       AND r.check_in_date <= $2
       AND r.check_out_date > $2
     ORDER BY p.name`,
    [req.tenantId, targetDate]
  );

  const total = result.rows.reduce((sum, row) => sum + parseInt(row.breakfast_count), 0);

  res.json({
    date: targetDate,
    total_breakfasts: total,
    reservations: result.rows
  });
}));

// GET /api/reservations/:id - Get single reservation
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT r.*,
       p.name as property_name,
       pt.name as property_type_name
     FROM reservations r
     LEFT JOIN properties p ON r.property_id = p.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  res.json(result.rows[0]);
}));

// POST /api/reservations - Create new reservation
router.post('/', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const {
    property_id,
    check_in_date,
    check_out_date,
    checkout_time,
    adults = 1,
    children = 0,
    infants = 0,
    has_breakfast = false,
    additional_requirements,
    notes
  } = req.body;

  if (!property_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'property_id, check_in_date, and check_out_date are required' });
  }

  // Validate dates
  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);

  if (checkOut <= checkIn) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check for overlapping reservations
    const overlapCheck = await client.query(
      `SELECT id FROM reservations
       WHERE tenant_id = $1
         AND property_id = $2
         AND status = 'active'
         AND (
           (check_in_date <= $3 AND check_out_date > $3) OR
           (check_in_date < $4 AND check_out_date >= $4) OR
           (check_in_date >= $3 AND check_out_date <= $4)
         )`,
      [req.tenantId, property_id, check_in_date, check_out_date]
    );

    if (overlapCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Property is already reserved for these dates' });
    }

    // Get tenant settings for cleaning intervals
    const tenantSettings = await client.query(
      'SELECT stay_over_interval FROM tenants WHERE id = $1',
      [req.tenantId]
    );
    const stayOverInterval = tenantSettings.rows[0]?.stay_over_interval || 3;

    // Insert reservation
    const reservationResult = await client.query(
      `INSERT INTO reservations (
        tenant_id, property_id, check_in_date, check_out_date, checkout_time,
        adults, children, infants, has_breakfast, additional_requirements, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [req.tenantId, property_id, check_in_date, check_out_date, checkout_time, adults, children, infants, has_breakfast, additional_requirements, notes]
    );

    const reservation = reservationResult.rows[0];

    // Generate cleaning tasks
    const tasksCreated = await generateCleaningTasks(client, reservation, req.tenantId, stayOverInterval);

    await client.query('COMMIT');

    res.status(201).json({
      reservation,
      cleaning_tasks_created: tasksCreated
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// PUT /api/reservations/:id - Update reservation
router.put('/:id', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    property_id,
    check_in_date,
    check_out_date,
    checkout_time,
    adults,
    children,
    infants,
    has_breakfast,
    additional_requirements,
    notes,
    status
  } = req.body;

  const result = await pool.query(
    `UPDATE reservations
     SET property_id = COALESCE($1, property_id),
         check_in_date = COALESCE($2, check_in_date),
         check_out_date = COALESCE($3, check_out_date),
         checkout_time = COALESCE($4, checkout_time),
         adults = COALESCE($5, adults),
         children = COALESCE($6, children),
         infants = COALESCE($7, infants),
         has_breakfast = COALESCE($8, has_breakfast),
         additional_requirements = COALESCE($9, additional_requirements),
         notes = COALESCE($10, notes),
         status = COALESCE($11, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $12 AND tenant_id = $13
     RETURNING *`,
    [property_id, check_in_date, check_out_date, checkout_time, adults, children, infants, has_breakfast, additional_requirements, notes, status, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  res.json(result.rows[0]);
}));

// DELETE /api/reservations/:id - Cancel reservation
router.delete('/:id', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cancel reservation
    const result = await client.query(
      `UPDATE reservations
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.tenantId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Cancel associated cleaning tasks
    await client.query(
      `UPDATE cleaning_tasks
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE reservation_id = $1 AND status = 'pending'`,
      [id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Reservation cancelled successfully', reservation: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
