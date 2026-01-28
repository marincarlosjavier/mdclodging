-- Add 'bathroom' to property_type_spaces space_type constraint
-- This allows bathrooms to be added as common areas in property types

-- Drop the old constraint
ALTER TABLE property_type_spaces
DROP CONSTRAINT property_type_spaces_space_type_check;

-- Add the new constraint with 'bathroom' included
ALTER TABLE property_type_spaces
ADD CONSTRAINT property_type_spaces_space_type_check
CHECK (space_type IN ('kitchen', 'living_room', 'dining_room', 'bathroom', 'terrace', 'balcony', 'laundry', 'other'));

-- Update comment
COMMENT ON COLUMN property_type_spaces.space_type IS 'Type of space: kitchen, living_room, dining_room, bathroom, terrace, balcony, laundry, other';
