import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/properties
 * List all properties for the tenant with their type information
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, property_type_id, is_active } = req.query;

  let query = `
    SELECT p.*,
      pt.name as type_name,
      pt.property_category,
      pt.department_id,
      pt.city_id,
      pt.zone_id,
      dept.name as department,
      city.name as city,
      zone.name as zone,
      (SELECT COUNT(*) FROM property_type_rooms WHERE property_type_id = pt.id) as room_count,
      (SELECT COALESCE(SUM(single_beds + double_beds + queen_beds + king_beds + sofa_beds), 0)
       FROM property_type_rooms WHERE property_type_id = pt.id) as total_beds
    FROM properties p
    INNER JOIN property_types pt ON p.property_type_id = pt.id
    LEFT JOIN catalog_items dept ON pt.department_id = dept.id
    LEFT JOIN catalog_items city ON pt.city_id = city.id
    LEFT JOIN catalog_items zone ON pt.zone_id = zone.id
    WHERE p.tenant_id = $1
  `;
  const params = [req.tenantId];
  let paramCount = 1;

  if (status) {
    paramCount++;
    query += ` AND p.status = $${paramCount}`;
    params.push(status);
  }

  if (property_type_id) {
    paramCount++;
    query += ` AND p.property_type_id = $${paramCount}`;
    params.push(property_type_id);
  }

  if (is_active !== undefined) {
    paramCount++;
    query += ` AND p.is_active = $${paramCount}`;
    params.push(is_active === 'true');
  }

  query += ' ORDER BY p.name';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/properties/:id
 * Get single property with full details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT p.*,
      pt.name as type_name,
      pt.description as type_description,
      pt.property_category,
      dept.name as department,
      city.name as city,
      zone.name as zone
     FROM properties p
     INNER JOIN property_types pt ON p.property_type_id = pt.id
     LEFT JOIN catalog_items dept ON pt.department_id = dept.id
     LEFT JOIN catalog_items city ON pt.city_id = city.id
     LEFT JOIN catalog_items zone ON pt.zone_id = zone.id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/properties
 * Create new property
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const {
    property_type_id,
    name,
    status,
    notes
  } = req.body;

  // Validation
  if (!property_type_id || !name) {
    return res.status(400).json({ error: 'Property type and name are required' });
  }

  // Check if property type exists and belongs to tenant
  const typeCheck = await pool.query(
    'SELECT id FROM property_types WHERE id = $1 AND tenant_id = $2',
    [property_type_id, req.tenantId]
  );

  if (typeCheck.rows.length === 0) {
    return res.status(400).json({ error: 'Property type not found or does not belong to your organization' });
  }

  // Check if name is unique for tenant
  const nameCheck = await pool.query(
    'SELECT id FROM properties WHERE name = $1 AND tenant_id = $2',
    [name, req.tenantId]
  );

  if (nameCheck.rows.length > 0) {
    return res.status(400).json({ error: 'A property with this name already exists' });
  }

  const result = await pool.query(
    `INSERT INTO properties (
      tenant_id, property_type_id, name, status, notes
    ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      req.tenantId,
      property_type_id,
      name,
      status || 'available',
      notes || null
    ]
  );

  res.status(201).json({
    message: 'Property created successfully',
    property: result.rows[0]
  });
}));

/**
 * PUT /api/properties/:id
 * Update property
 */
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    status,
    is_active,
    notes
  } = req.body;

  // Check ownership
  const checkResult = await pool.query(
    'SELECT id FROM properties WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  // Check if new name conflicts with existing property
  if (name) {
    const nameCheck = await pool.query(
      'SELECT id FROM properties WHERE name = $1 AND tenant_id = $2 AND id != $3',
      [name, req.tenantId, id]
    );

    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'A property with this name already exists' });
    }
  }

  await pool.query(
    `UPDATE properties
     SET name = COALESCE($1, name),
         status = COALESCE($2, status),
         is_active = COALESCE($3, is_active),
         notes = COALESCE($4, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5`,
    [name, status, is_active, notes, id]
  );

  res.json({ message: 'Property updated successfully' });
}));

/**
 * DELETE /api/properties/:id
 * Delete property
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM properties WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json({ message: 'Property deleted successfully' });
}));

export default router;
