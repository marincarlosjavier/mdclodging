-- Migration: Remove nomenclature fields and add capacity to property_types
-- Date: 2026-02-08
-- Description: Simplifies property types by removing location fields, nomenclature configuration,
--              and unit generation capabilities. Adds max_capacity field for adult capacity.

-- Drop nomenclature columns that are no longer needed
ALTER TABLE property_types
DROP COLUMN IF EXISTS room_count,
DROP COLUMN IF EXISTS room_nomenclature_type,
DROP COLUMN IF EXISTS room_nomenclature_prefix,
DROP COLUMN IF EXISTS room_nomenclature_start,
DROP COLUMN IF EXISTS room_nomenclature_examples;

-- Add capacity field with default value
ALTER TABLE property_types
ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 2;

-- Mark location fields as deprecated (keep for historical data, but no longer used)
COMMENT ON COLUMN property_types.department_id IS 'DEPRECATED - No longer used. Kept for historical data only.';
COMMENT ON COLUMN property_types.city_id IS 'DEPRECATED - No longer used. Kept for historical data only.';
COMMENT ON COLUMN property_types.zone_id IS 'DEPRECATED - No longer used. Kept for historical data only.';

-- Add comment to new field
COMMENT ON COLUMN property_types.max_capacity IS 'Maximum adult capacity (children and infants not included)';

-- Create index on capacity for efficient filtering
CREATE INDEX IF NOT EXISTS idx_property_types_capacity ON property_types(max_capacity);

-- Update any existing property types to have a reasonable default capacity if they don't have one
-- This is redundant with the DEFAULT clause above, but ensures consistency
UPDATE property_types
SET max_capacity = 2
WHERE max_capacity IS NULL;
