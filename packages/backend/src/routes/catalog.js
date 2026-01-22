import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/catalog
 * List all catalog items with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category, type, parent_id } = req.query;

  let query = `
    SELECT ci.*,
      (SELECT COUNT(*) FROM catalog_items WHERE parent_id = ci.id) as children_count,
      parent.name as parent_name
    FROM catalog_items ci
    LEFT JOIN catalog_items parent ON ci.parent_id = parent.id
    WHERE ci.tenant_id = $1
  `;
  const params = [req.tenantId];
  let paramCount = 1;

  if (category) {
    paramCount++;
    query += ` AND ci.category = $${paramCount}`;
    params.push(category);
  }

  if (type) {
    paramCount++;
    query += ` AND ci.type = $${paramCount}`;
    params.push(type);
  }

  if (parent_id !== undefined) {
    paramCount++;
    if (parent_id === 'null' || parent_id === '') {
      query += ` AND ci.parent_id IS NULL`;
    } else {
      query += ` AND ci.parent_id = $${paramCount}`;
      params.push(parent_id);
    }
  }

  query += ' ORDER BY ci.category, ci.type, ci.name';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/catalog/:id
 * Get single catalog item
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT ci.*,
      parent.name as parent_name
     FROM catalog_items ci
     LEFT JOIN catalog_items parent ON ci.parent_id = parent.id
     WHERE ci.id = $1 AND ci.tenant_id = $2`,
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }

  res.json(result.rows[0]);
}));

/**
 * POST /api/catalog
 * Create new catalog item
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { category, type, name, parent_id, description } = req.body;

  // Validation
  if (!category || !type || !name) {
    return res.status(400).json({ error: 'Category, type, and name are required' });
  }

  const result = await pool.query(
    `INSERT INTO catalog_items (tenant_id, category, type, name, parent_id, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.tenantId, category, type, name, parent_id || null, description || null]
  );

  res.status(201).json({
    message: 'Catalog item created successfully',
    item: result.rows[0]
  });
}));

/**
 * PUT /api/catalog/:id
 * Update catalog item
 */
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, type, name, parent_id, description, is_active } = req.body;

  // Check ownership
  const checkResult = await pool.query(
    'SELECT id FROM catalog_items WHERE id = $1 AND tenant_id = $2',
    [id, req.tenantId]
  );

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }

  const result = await pool.query(
    `UPDATE catalog_items
     SET category = $1, type = $2, name = $3, parent_id = $4,
         description = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 RETURNING *`,
    [
      category,
      type,
      name,
      parent_id || null,
      description || null,
      is_active !== undefined ? is_active : true,
      id
    ]
  );

  res.json({
    message: 'Catalog item updated successfully',
    item: result.rows[0]
  });
}));

/**
 * DELETE /api/catalog/:id
 * Delete catalog item
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if item has children
  const childrenCheck = await pool.query(
    'SELECT COUNT(*) as count FROM catalog_items WHERE parent_id = $1',
    [id]
  );

  if (parseInt(childrenCheck.rows[0].count) > 0) {
    return res.status(400).json({
      error: 'Cannot delete item with children. Delete children first.'
    });
  }

  const result = await pool.query(
    'DELETE FROM catalog_items WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }

  res.json({ message: 'Catalog item deleted successfully' });
}));

export default router;
