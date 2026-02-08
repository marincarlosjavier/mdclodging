import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { checkPropertyQuota } from '../middleware/quota.js';

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

// POST /api/properties - Create property (single or batch)
router.post('/', requireRole('admin', 'supervisor'), checkPropertyQuota, asyncHandler(async (req, res) => {
  const { property_type_id, name, status, notes, city, location, quantity, property_names } = req.body;

  if (!property_type_id) {
    return res.status(400).json({ error: 'property_type_id is required' });
  }

  // Verify property type exists and belongs to tenant
  const typeCheck = await pool.query(
    'SELECT id FROM property_types WHERE id = $1 AND tenant_id = $2',
    [property_type_id, req.tenantId]
  );

  if (typeCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Property type not found' });
  }

  // BATCH CREATION MODE
  if (quantity && quantity > 1 && property_names && property_names.length > 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const createdProperties = [];
      const errors = [];

      for (let i = 0; i < property_names.length; i++) {
        const propName = property_names[i];
        if (!propName || propName.trim() === '') continue;

        try {
          const result = await client.query(
            `INSERT INTO properties (tenant_id, property_type_id, name, status, notes, city, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.tenantId, property_type_id, propName, status || 'available', notes, city, location]
          );
          createdProperties.push(result.rows[0]);
        } catch (error) {
          if (error.code === '23505') {
            errors.push({ name: propName, error: 'Property name already exists' });
          } else {
            errors.push({ name: propName, error: error.message });
          }
        }
      }

      await client.query('COMMIT');
      return res.status(201).json({
        created: createdProperties,
        errors: errors,
        success_count: createdProperties.length,
        error_count: errors.length
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // SINGLE PROPERTY CREATION
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const result = await pool.query(
    `INSERT INTO properties (tenant_id, property_type_id, name, status, notes, city, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.tenantId, property_type_id, name, status || 'available', notes, city, location]
  );

  res.status(201).json(result.rows[0]);
}));

// PUT /api/properties/:id - Update property
router.put('/:id', requireRole('admin', 'supervisor'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { property_type_id, name, status, notes, is_active, city, location } = req.body;

  const result = await pool.query(
    `UPDATE properties
     SET property_type_id = COALESCE($1, property_type_id),
         name = COALESCE($2, name),
         status = COALESCE($3, status),
         notes = COALESCE($4, notes),
         is_active = COALESCE($5, is_active),
         city = COALESCE($6, city),
         location = COALESCE($7, location),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8 AND tenant_id = $9
     RETURNING *`,
    [property_type_id, name, status, notes, is_active, city, location, id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property not found' });
  }

  res.json(result.rows[0]);
}));

// DELETE /api/properties/:id - Delete property
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
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
