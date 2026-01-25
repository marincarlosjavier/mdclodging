import express from 'express';
import { pool } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();
router.use(authenticate);

// GET /api/tenants/settings - Get tenant settings
router.get('/settings', asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT stay_over_interval, deep_cleaning_interval, timezone FROM tenants WHERE id = $1',
    [req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  res.json(result.rows[0]);
}));

// PUT /api/tenants/settings - Update tenant settings
router.put('/settings', asyncHandler(async (req, res) => {
  const { stay_over_interval, deep_cleaning_interval, timezone } = req.body;

  const result = await pool.query(
    `UPDATE tenants
     SET stay_over_interval = $1,
         deep_cleaning_interval = $2,
         timezone = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING stay_over_interval, deep_cleaning_interval, timezone`,
    [stay_over_interval, deep_cleaning_interval, timezone, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  res.json(result.rows[0]);
}));

export default router;
