import express from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/property-types
 * List all property types for the tenant
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category, is_active } = req.query;

  let query = `
    SELECT pt.*,
      (SELECT COUNT(*) FROM property_type_rooms WHERE property_type_id = pt.id) as room_count,
      (SELECT COUNT(*) FROM property_type_spaces WHERE property_type_id = pt.id) as space_count,
      (SELECT COUNT(*) FROM property_type_rooms WHERE property_type_id = pt.id) as total_bedrooms,
      (SELECT COALESCE(SUM(single_beds + double_beds + queen_beds + king_beds + sofa_beds), 0)
       FROM property_type_rooms WHERE property_type_id = pt.id) as total_beds,
      (SELECT COALESCE(SUM(single_beds), 0) FROM property_type_rooms WHERE property_type_id = pt.id) as total_single_beds,
      (SELECT COALESCE(SUM(double_beds), 0) FROM property_type_rooms WHERE property_type_id = pt.id) as total_double_beds,
      (SELECT COALESCE(SUM(queen_beds), 0) FROM property_type_rooms WHERE property_type_id = pt.id) as total_queen_beds,
      (SELECT COALESCE(SUM(king_beds), 0) FROM property_type_rooms WHERE property_type_id = pt.id) as total_king_beds,
      (SELECT COALESCE(SUM(sofa_beds), 0) FROM property_type_rooms WHERE property_type_id = pt.id) as total_sofa_beds,
      (SELECT COUNT(*) FROM property_type_rooms WHERE property_type_id = pt.id AND has_bathroom = true) as total_bathrooms,
      (SELECT STRING_AGG(DISTINCT space_type, ', ')
       FROM property_type_spaces WHERE property_type_id = pt.id) as space_types
    FROM property_types pt
    WHERE pt.tenant_id = $1
  `;
  const params = [req.tenantId];
  let paramCount = 1;

  if (category) {
    paramCount++;
    query += ` AND pt.property_category = $${paramCount}`;
    params.push(category);
  }

  if (is_active !== undefined) {
    paramCount++;
    query += ` AND pt.is_active = $${paramCount}`;
    params.push(is_active === 'true');
  }

  query += ' ORDER BY pt.created_at DESC';

  const result = await pool.query(query, params);
  res.json(result.rows);
}));

/**
 * GET /api/property-types/:id
 * Get single property type with all details (rooms and spaces)
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [typeResult, roomsResult, spacesResult] = await Promise.all([
    pool.query(
      `SELECT pt.*
       FROM property_types pt
       WHERE pt.id = $1 AND pt.tenant_id = $2`,
      [id, req.tenantId]
    ),
    pool.query(
      'SELECT * FROM property_type_rooms WHERE property_type_id = $1 ORDER BY room_order',
      [id]
    ),
    pool.query(
      'SELECT * FROM property_type_spaces WHERE property_type_id = $1',
      [id]
    )
  ]);

  if (typeResult.rows.length === 0) {
    return res.status(404).json({ error: 'Property type not found' });
  }

  // Transform room bed counts back to beds array format for frontend
  const rooms = roomsResult.rows.map(room => {
    const beds = [];
    if (room.single_beds > 0) beds.push({ type: 'single', quantity: room.single_beds });
    if (room.double_beds > 0) beds.push({ type: 'double', quantity: room.double_beds });
    if (room.queen_beds > 0) beds.push({ type: 'queen', quantity: room.queen_beds });
    if (room.king_beds > 0) beds.push({ type: 'king', quantity: room.king_beds });
    if (room.sofa_beds > 0) beds.push({ type: 'sofa_bed', quantity: room.sofa_beds });

    return {
      ...room,
      beds
    };
  });

  res.json({
    ...typeResult.rows[0],
    rooms,
    spaces: spacesResult.rows
  });
}));

/**
 * POST /api/property-types
 * Create new property type
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const {
    name,
    description,
    property_category,
    max_capacity,
    rooms,
    spaces
  } = req.body;

  // Validation
  if (!name || !property_category || !max_capacity) {
    return res.status(400).json({ error: 'Name, property category, and max capacity are required' });
  }

  if (max_capacity < 1) {
    return res.status(400).json({ error: 'Max capacity must be at least 1' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert property type
    const typeResult = await client.query(
      `INSERT INTO property_types (
        tenant_id, name, description, property_category, max_capacity
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        req.tenantId,
        name,
        description,
        property_category,
        max_capacity
      ]
    );
    const propertyTypeId = typeResult.rows[0].id;

    // Insert rooms
    if (rooms && rooms.length > 0) {
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];

        // Process beds array to get individual bed counts
        let single_beds = 0, double_beds = 0, queen_beds = 0, king_beds = 0, sofa_beds = 0;
        if (room.beds && Array.isArray(room.beds)) {
          room.beds.forEach(bed => {
            const qty = parseInt(bed.quantity) || 0;
            switch (bed.type) {
              case 'single': single_beds += qty; break;
              case 'double': double_beds += qty; break;
              case 'queen': queen_beds += qty; break;
              case 'king': king_beds += qty; break;
              case 'sofa_bed': sofa_beds += qty; break;
            }
          });
        }

        await client.query(
          `INSERT INTO property_type_rooms (
            property_type_id, room_name, room_order,
            single_beds, double_beds, queen_beds, king_beds, sofa_beds,
            sofas, armchairs,
            has_bathroom, has_tv, has_closet, has_air_conditioning,
            default_bath_towels, default_hand_towels, default_bath_mats,
            default_standard_pillows, default_decorative_pillows,
            default_sheets_sets, default_blankets,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            propertyTypeId,
            room.room_name,
            i + 1,
            single_beds,
            double_beds,
            queen_beds,
            king_beds,
            sofa_beds,
            room.sofas || 0,
            room.armchairs || 0,
            room.has_bathroom || false,
            room.has_tv || false,
            room.has_closet || false,
            room.has_air_conditioning || false,
            room.default_bath_towels || 0,
            room.default_hand_towels || 0,
            room.default_bath_mats || 0,
            room.default_standard_pillows || 0,
            room.default_decorative_pillows || 0,
            room.default_sheets_sets || 0,
            room.default_blankets || 0,
            room.notes || null
          ]
        );
      }
    }

    // Insert spaces
    if (spaces && spaces.length > 0) {
      for (const space of spaces) {
        await client.query(
          `INSERT INTO property_type_spaces (
            property_type_id, space_type, space_name, description,
            has_stove, has_refrigerator, has_microwave, has_dishwasher,
            has_dining_table, dining_capacity,
            has_washer, has_dryer,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            propertyTypeId,
            space.space_type,
            space.space_name || null,
            space.description || null,
            space.has_stove || false,
            space.has_refrigerator || false,
            space.has_microwave || false,
            space.has_dishwasher || false,
            space.has_dining_table || false,
            space.dining_capacity || null,
            space.has_washer || false,
            space.has_dryer || false,
            space.notes || null
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Property type created successfully',
      id: propertyTypeId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * PUT /api/property-types/:id
 * Update property type
 */
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    property_category,
    is_active,
    max_capacity,
    rooms,
    spaces
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check ownership
    const checkResult = await client.query(
      'SELECT id FROM property_types WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Property type not found' });
    }

    // Update property type
    await client.query(
      `UPDATE property_types
       SET name = $1, description = $2, property_category = $3,
           is_active = $4, max_capacity = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        name,
        description,
        property_category,
        is_active !== undefined ? is_active : true,
        max_capacity,
        id
      ]
    );

    // Delete existing rooms and spaces
    await client.query('DELETE FROM property_type_rooms WHERE property_type_id = $1', [id]);
    await client.query('DELETE FROM property_type_spaces WHERE property_type_id = $1', [id]);

    // Re-insert rooms
    if (rooms && rooms.length > 0) {
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];

        // Process beds array to get individual bed counts
        let single_beds = 0, double_beds = 0, queen_beds = 0, king_beds = 0, sofa_beds = 0;
        if (room.beds && Array.isArray(room.beds)) {
          room.beds.forEach(bed => {
            const qty = parseInt(bed.quantity) || 0;
            switch (bed.type) {
              case 'single': single_beds += qty; break;
              case 'double': double_beds += qty; break;
              case 'queen': queen_beds += qty; break;
              case 'king': king_beds += qty; break;
              case 'sofa_bed': sofa_beds += qty; break;
            }
          });
        }

        await client.query(
          `INSERT INTO property_type_rooms (
            property_type_id, room_name, room_order,
            single_beds, double_beds, queen_beds, king_beds, sofa_beds,
            sofas, armchairs,
            has_bathroom, has_tv, has_closet, has_air_conditioning,
            default_bath_towels, default_hand_towels, default_bath_mats,
            default_standard_pillows, default_decorative_pillows,
            default_sheets_sets, default_blankets,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            id,
            room.room_name,
            i + 1,
            single_beds,
            double_beds,
            queen_beds,
            king_beds,
            sofa_beds,
            room.sofas || 0,
            room.armchairs || 0,
            room.has_bathroom || false,
            room.has_tv || false,
            room.has_closet || false,
            room.has_air_conditioning || false,
            room.default_bath_towels || 0,
            room.default_hand_towels || 0,
            room.default_bath_mats || 0,
            room.default_standard_pillows || 0,
            room.default_decorative_pillows || 0,
            room.default_sheets_sets || 0,
            room.default_blankets || 0,
            room.notes || null
          ]
        );
      }
    }

    // Re-insert spaces
    if (spaces && spaces.length > 0) {
      for (const space of spaces) {
        await client.query(
          `INSERT INTO property_type_spaces (
            property_type_id, space_type, space_name, description,
            has_stove, has_refrigerator, has_microwave, has_dishwasher,
            has_dining_table, dining_capacity,
            has_washer, has_dryer,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            id,
            space.space_type,
            space.space_name || null,
            space.description || null,
            space.has_stove || false,
            space.has_refrigerator || false,
            space.has_microwave || false,
            space.has_dishwasher || false,
            space.has_dining_table || false,
            space.dining_capacity || null,
            space.has_washer || false,
            space.has_dryer || false,
            space.notes || null
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'Property type updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * DELETE /api/property-types/:id
 * Delete property type
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    'DELETE FROM property_types WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.tenantId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Property type not found' });
  }

  res.json({ message: 'Property type deleted successfully' });
}));

export default router;
