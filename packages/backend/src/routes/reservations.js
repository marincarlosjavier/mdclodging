import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { notifyCheckout } from '../telegram/bot.js';

const router = express.Router();
router.use(authenticate);

// Helper function to generate cleaning tasks for a reservation
async function generateCleaningTasks(client, reservation, tenantId, stayOverInterval, deepCleanInterval = 30) {
  const tasks = [];
  const checkInDate = new Date(reservation.check_in_date);
  const checkOutDate = new Date(reservation.check_out_date);

  // Calculate days of stay
  const daysDiff = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  // 1. Generate check-out cleaning task (Aseo General - on checkout date)
  tasks.push({
    type: 'check_out',
    date: checkOutDate
  });

  // 2. Generate stay-over cleaning tasks (Aseo Liviano - every X days during stay)
  if (daysDiff > stayOverInterval) {
    let currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + stayOverInterval);

    while (currentDate < checkOutDate) {
      // Check if this date coincides with a deep clean
      const daysFromCheckIn = Math.floor((currentDate - checkInDate) / (1000 * 60 * 60 * 24));
      const isDeepCleanDay = daysFromCheckIn % deepCleanInterval === 0;

      if (!isDeepCleanDay) {
        tasks.push({
          type: 'stay_over',
          date: new Date(currentDate)
        });
      }
      currentDate.setDate(currentDate.getDate() + stayOverInterval);
    }
  }

  // 3. Generate deep cleaning tasks (Aseo Profundo - every 30 days during stay)
  if (daysDiff > deepCleanInterval) {
    let currentDate = new Date(checkInDate);
    currentDate.setDate(currentDate.getDate() + deepCleanInterval);

    while (currentDate < checkOutDate) {
      tasks.push({
        type: 'deep_clean',
        date: new Date(currentDate)
      });
      currentDate.setDate(currentDate.getDate() + deepCleanInterval);
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

// GET /api/reservations/checkin-report - Get daily check-in report
router.get('/checkin-report', asyncHandler(async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `SELECT
      r.id,
      r.check_in_date,
      r.check_out_date,
      r.checkout_time,
      r.adults,
      r.children,
      r.infants,
      r.has_breakfast,
      r.additional_requirements,
      r.notes,
      r.status as reservation_status,
      p.id as property_id,
      p.name as property_name,
      pt.id as property_type_id,
      pt.name as property_type_name
     FROM reservations r
     LEFT JOIN properties p ON r.property_id = p.id
     LEFT JOIN property_types pt ON p.property_type_id = pt.id
     WHERE r.tenant_id = $1
       AND r.check_in_date = $2
       AND r.status = 'active'
     ORDER BY r.check_in_date, p.name`,
    [req.tenantId, targetDate]
  );

  res.json({
    date: targetDate,
    total_checkins: result.rows.length,
    checkins: result.rows
  });
}));

// GET /api/reservations/checkout-report - Get checkout report
router.get('/checkout-report', asyncHandler(async (req, res) => {
  const { date, statuses } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Parse statuses from comma-separated list
  const statusList = statuses ? statuses.split(',') : ['pending', 'checked_out', 'in_progress'];

  // Build conditions based on selected statuses
  const conditions = [];
  const params = [req.tenantId];

  // Map frontend statuses to backend conditions
  const taskConditions = [];

  if (statusList.includes('checked_out')) {
    taskConditions.push(`(ct.status = 'pending' AND r.actual_checkout_time IS NOT NULL AND ct.started_at IS NULL)`);
  }
  if (statusList.includes('in_progress')) {
    taskConditions.push(`ct.status = 'in_progress'`);
  }
  if (statusList.includes('completed')) {
    params.push(targetDate);
    // Show completed tasks based on when they were completed, not checkout date
    taskConditions.push(`(ct.status = 'completed' AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $${params.length})`);
  }

  // Build WHERE clause
  params.push(targetDate);
  const dateFilterParam = params.length;

  let whereClause = `r.tenant_id = $1 AND r.status IN ('active', 'checked_in', 'checked_out')`;

  // "pending" (Esp. Check out) - show reservations with checkout today but no actual_checkout_time
  if (statusList.includes('pending')) {
    if (taskConditions.length > 0) {
      // Also include other task conditions
      whereClause += ` AND (
        (r.check_out_date = $${dateFilterParam} AND r.actual_checkout_time IS NULL)
        OR (ct.id IS NOT NULL AND (${taskConditions.join(' OR ')}))
      )`;
    } else {
      // Only pending
      whereClause += ` AND r.check_out_date = $${dateFilterParam} AND r.actual_checkout_time IS NULL`;
    }
  } else if (taskConditions.length > 0) {
    // Other statuses require cleaning task to exist
    whereClause += ` AND ct.id IS NOT NULL AND (${taskConditions.join(' OR ')})`;
    whereClause += ` AND (
      (ct.status != 'completed' AND r.check_out_date = $${dateFilterParam})
      OR
      (ct.status = 'completed' AND DATE(ct.completed_at AT TIME ZONE 'America/Bogota') = $${dateFilterParam})
    )`;
  } else {
    // No conditions, return empty result
    return res.json({
      date: targetDate,
      total_checkouts: 0,
      checkouts: []
    });
  }

  const result = await pool.query(
    `SELECT
      r.id,
      r.check_out_date,
      r.reference,
      COALESCE(r.checkout_time, '12:00') as checkout_time,
      r.actual_checkout_time,
      r.adults,
      r.children,
      r.infants,
      r.status as reservation_status,
      p.name as property_name,
      pt.name as property_type_name,
      ct.id as cleaning_task_id,
      ct.task_type as cleaning_task_type,
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
     WHERE ${whereClause}
     ORDER BY
       CASE WHEN ct.status = 'completed' THEN 1 ELSE 0 END,
       r.check_out_date,
       COALESCE(r.checkout_time, '12:00'),
       r.actual_checkout_time,
       p.name`,
    params
  );

  res.json({
    date: targetDate,
    total_checkouts: result.rows.length,
    checkouts: result.rows
  });
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
    checkin_time = '15:00',
    checkout_time = '12:00',
    adults = 1,
    children = 0,
    infants = 0,
    has_breakfast = false,
    reference,
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
      'SELECT stay_over_interval, deep_cleaning_interval FROM tenants WHERE id = $1',
      [req.tenantId]
    );
    const stayOverInterval = tenantSettings.rows[0]?.stay_over_interval || 3;
    const deepCleanInterval = tenantSettings.rows[0]?.deep_cleaning_interval || 30;

    // Insert reservation
    const reservationResult = await client.query(
      `INSERT INTO reservations (
        tenant_id, property_id, check_in_date, check_out_date, checkin_time, checkout_time,
        adults, children, infants, has_breakfast, reference, additional_requirements, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [req.tenantId, property_id, check_in_date, check_out_date, checkin_time, checkout_time, adults, children, infants, has_breakfast, reference, additional_requirements, notes]
    );

    const reservation = reservationResult.rows[0];

    // Generate cleaning tasks
    const tasksCreated = await generateCleaningTasks(client, reservation, req.tenantId, stayOverInterval, deepCleanInterval);

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
    checkin_time,
    checkout_time,
    actual_checkin_time,
    actual_checkout_time,
    adults,
    children,
    infants,
    has_breakfast,
    reference,
    additional_requirements,
    notes,
    status,
    is_priority
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current reservation to check if actual_checkout_time is being newly set
    const currentResult = await client.query(
      'SELECT *, p.name as property_name FROM reservations r LEFT JOIN properties p ON p.id = r.property_id WHERE r.id = $1 AND r.tenant_id = $2',
      [id, req.tenantId]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const currentReservation = currentResult.rows[0];

    // If status is being changed to 'checked_out' but no actual_checkout_time is provided,
    // automatically set it to current Colombia time
    let finalActualCheckoutTime = actual_checkout_time;
    if (status === 'checked_out' &&
        actual_checkout_time === undefined &&
        !currentReservation.actual_checkout_time) {
      // Get current time in Colombia timezone (HH:MM:SS format)
      const now = new Date();
      const colombiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const hours = String(colombiaTime.getHours()).padStart(2, '0');
      const minutes = String(colombiaTime.getMinutes()).padStart(2, '0');
      const seconds = String(colombiaTime.getSeconds()).padStart(2, '0');
      finalActualCheckoutTime = `${hours}:${minutes}:${seconds}`;
    }

    // If status is being changed FROM 'checked_out' to something else (like 'checked_in'),
    // automatically clear the actual_checkout_time
    if (status !== undefined &&
        status !== 'checked_out' &&
        currentReservation.status === 'checked_out' &&
        actual_checkout_time === undefined) {
      finalActualCheckoutTime = null;
    }

    const isCheckoutReported = finalActualCheckoutTime && !currentReservation.actual_checkout_time;
    const isCheckoutCancelled = finalActualCheckoutTime === null && currentReservation.actual_checkout_time;

    // Build update query dynamically to allow setting NULL
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (property_id !== undefined) {
      paramCount++;
      updates.push(`property_id = $${paramCount}`);
      params.push(property_id);
    }
    if (check_in_date !== undefined) {
      paramCount++;
      updates.push(`check_in_date = $${paramCount}`);
      params.push(check_in_date);
    }
    if (check_out_date !== undefined) {
      paramCount++;
      updates.push(`check_out_date = $${paramCount}`);
      params.push(check_out_date);
    }
    if (checkin_time !== undefined) {
      paramCount++;
      updates.push(`checkin_time = $${paramCount}`);
      params.push(checkin_time);
    }
    if (checkout_time !== undefined) {
      paramCount++;
      updates.push(`checkout_time = $${paramCount}`);
      params.push(checkout_time);
    }
    if (actual_checkin_time !== undefined) {
      paramCount++;
      updates.push(`actual_checkin_time = $${paramCount}`);
      params.push(actual_checkin_time);
    }
    if (finalActualCheckoutTime !== undefined) {
      paramCount++;
      updates.push(`actual_checkout_time = $${paramCount}`);
      params.push(finalActualCheckoutTime);
    }
    if (adults !== undefined) {
      paramCount++;
      updates.push(`adults = $${paramCount}`);
      params.push(adults);
    }
    if (children !== undefined) {
      paramCount++;
      updates.push(`children = $${paramCount}`);
      params.push(children);
    }
    if (infants !== undefined) {
      paramCount++;
      updates.push(`infants = $${paramCount}`);
      params.push(infants);
    }
    if (has_breakfast !== undefined) {
      paramCount++;
      updates.push(`has_breakfast = $${paramCount}`);
      params.push(has_breakfast);
    }
    if (reference !== undefined) {
      paramCount++;
      updates.push(`reference = $${paramCount}`);
      params.push(reference);
    }
    if (additional_requirements !== undefined) {
      paramCount++;
      updates.push(`additional_requirements = $${paramCount}`);
      params.push(additional_requirements);
    }
    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      params.push(notes);
    }
    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    paramCount++;
    params.push(id);
    const idParam = paramCount;

    paramCount++;
    params.push(req.tenantId);
    const tenantParam = paramCount;

    const result = await client.query(
      `UPDATE reservations
       SET ${updates.join(', ')}
       WHERE id = $${idParam} AND tenant_id = $${tenantParam}
       RETURNING *`,
      params
    );

    const updatedReservation = result.rows[0];

    // If checkout was just reported, create/update cleaning task
    if (isCheckoutReported) {
      // Check if check_out cleaning task exists
      const taskCheck = await client.query(
        `SELECT id FROM cleaning_tasks
         WHERE reservation_id = $1 AND task_type = 'check_out'`,
        [id]
      );

      if (taskCheck.rows.length > 0) {
        // Update existing task
        await client.query(
          `UPDATE cleaning_tasks
           SET status = 'pending',
               checkout_reported_at = NOW(),
               is_priority = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [taskCheck.rows[0].id, is_priority || false]
        );
      } else {
        // Create new checkout cleaning task
        await client.query(
          `INSERT INTO cleaning_tasks (
            tenant_id, property_id, reservation_id, task_type,
            scheduled_date, status, checkout_reported_at, is_priority
          ) VALUES ($1, $2, $3, 'check_out', $4, 'pending', NOW(), $5)`,
          [req.tenantId, updatedReservation.property_id, id, new Date(), is_priority || false]
        );
      }

      // Send Telegram notification to housekeeping staff
      await notifyCheckout(req.tenantId, {
        property_name: currentReservation.property_name,
        actual_checkout_time,
        adults: updatedReservation.adults,
        children: updatedReservation.children,
        infants: updatedReservation.infants,
        is_priority: is_priority || false
      });
    }

    // If checkout was cancelled, delete the checkout cleaning task if not started
    // or reset it if already in progress
    if (isCheckoutCancelled) {
      const taskResult = await client.query(
        `SELECT id, status, started_at FROM cleaning_tasks
         WHERE reservation_id = $1 AND task_type = 'check_out'`,
        [id]
      );

      if (taskResult.rows.length > 0) {
        const task = taskResult.rows[0];

        // If task hasn't been started yet, delete it completely
        if (!task.started_at && task.status === 'pending') {
          await client.query(
            `DELETE FROM cleaning_tasks WHERE id = $1`,
            [task.id]
          );
        } else {
          // If task is in progress or has been started, reset it to pending
          await client.query(
            `UPDATE cleaning_tasks
             SET status = 'pending',
                 assigned_to = NULL,
                 assigned_at = NULL,
                 started_at = NULL,
                 checkout_reported_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [task.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(updatedReservation);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
