-- Update property_types to use catalog references instead of text fields

-- Drop old text columns
ALTER TABLE property_types
DROP COLUMN IF EXISTS department,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS zone;

-- Add catalog reference columns
ALTER TABLE property_types
ADD COLUMN department_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
ADD COLUMN city_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
ADD COLUMN zone_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL;

-- Comments
COMMENT ON COLUMN property_types.department_id IS 'Reference to department catalog item';
COMMENT ON COLUMN property_types.city_id IS 'Reference to city catalog item';
COMMENT ON COLUMN property_types.zone_id IS 'Reference to zone/building catalog item';
