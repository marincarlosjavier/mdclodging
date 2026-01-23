import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();
router.use(authenticate);

// GET /api/properties - List all properties with filters
router.get('/', asyncHandler(async (req, res) => {
  const { property_type_id, status, search } = req.query;

  let query = `
    SELECT p.*,
      pt.name as type_name,
      pt.property_category,
      c_dept.name as department,
      c_city.name as city,
      c_zone.name as zone,
      (SELECT COUNT(*) FROM property_type_rooms ptr WHERE ptr.property_type_id = p.property_type_id) as room_count,
      (SELECT COALESCE(SUM(ptr.single_beds + ptr.double_beds + ptr.queen_beds + ptr.king_beds + ptr.sofa_beds), 0)
       FROM property_type_rooms ptr WHERE ptr.property_type_id = p.property_type_id) as total_beds
    FROM properties p
    LEFT JOIN property_types pt ON p.property_type_id = pt.id
    LEFT JOIN catalog_items c_dept ON pt.department_id = c_dept.id
    LEFT JOIN catalog_items c_city ON pt.city_id = c_city.id
    LEFT JOIN catalog_items c_zone ON pt.zone_id = c_zone.id
    WHERE p.tenant_id = $1
  `;

  const params = [req.tenantId];
  let paramCount = 1;

  if (property_type_id) {
    paramCount++;
    query += ` AND p.property_type_id = $${paramCount}`;
    params.push(property_type_id);
  }

  if (status) {
    paramCount++;
    query += ` AND p.status = $${paramCount}`;
    params.push(status);
  }

  if (search) {
    paramCount++;
    query += ` AND (p.name ILIKE $${paramCount} OR pt.name ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY p.name';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

// GET /api/properties/:id - Get single property
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(`
    SELECT p.*,
      pt.name as type_name,
      pt.property_category,
      c_dept.name as department,
      c_city.name as city,
      c_zone.name as zone
    FROM properties p
    LEFT JOIN property_types pt ON p.property_type_id = pt.id
    LEFT JOIN catalog_items c_dept ON pt.department_id = c_dept.id
    LEFT JOIN catalog_items c_city ON pt.city_id = c_city.id
    LEFT JOIN catalog_items c_zone ON pt.zone_id = c_zone.id
    WHERE p.id = $1 AND p.tenant_id = $2
  `, [id, req.tenantId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json(result.rows[0]);
}));

// POST /api/properties - Create single property manually
router.post('/', requireRole(['admin', 'supervisor']), asyncHandler(async (req, res) => {
  const { property_type_id, name, status, notes } = req.body;

  if (!property_type_id || !name) {
    return res.status(400).json({ error: 'property_type_id and name are required' });
  }

  // Verify property type exists and belongs to tenant
  const typeCheck = await pool.query(
    'SELECT id FROM property_types WHERE id = $1 AND tenant_id = $2',
    [property_type_id, req.tenantId]
  );

  if (typeCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Property type not found' });
  }

  const result = await pool.query(
    `INSERT INTO properties (tenant_id, property_type_id, name, status, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.tenantId, property_type_id, name, status || 'available', notes]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/properties/:id - Update property
router.put('/:id', requireRole(['admin', 'supervisor']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, status, notes, is_active } = req.body;

  const result = await pool.query(
    `UPDATE properties
     SET name = COALESCE($1, name),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         is_active = COALESCE($4, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 AND tenant_id = $6
     RETURNING *`,
    [name, status, notes, is_active, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json(result.rows[0]);
}));

// DELETE /api/properties/:id - Delete property
router.delete('/:id', requireRole(['admin']), asyncHandler(async (req, res) => {
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
