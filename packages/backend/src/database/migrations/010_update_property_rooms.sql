-- Update property_type_rooms table to differentiate towels and pillows
-- Add columns for room nomenclature

-- Drop old columns
ALTER TABLE property_type_rooms
DROP COLUMN IF EXISTS default_towels,
DROP COLUMN IF EXISTS default_pillows;

-- Add differentiated towel columns
ALTER TABLE property_type_rooms
ADD COLUMN default_bath_towels INTEGER DEFAULT 0,
ADD COLUMN default_hand_towels INTEGER DEFAULT 0,
ADD COLUMN default_bath_mats INTEGER DEFAULT 0;

-- Add differentiated pillow columns
ALTER TABLE property_type_rooms
ADD COLUMN default_standard_pillows INTEGER DEFAULT 0,
ADD COLUMN default_decorative_pillows INTEGER DEFAULT 0;

-- Add nomenclature fields
ALTER TABLE property_types
ADD COLUMN room_count INTEGER DEFAULT 1,
ADD COLUMN room_nomenclature_type VARCHAR(50) DEFAULT 'numeric'
    CHECK (room_nomenclature_type IN ('numeric', 'alphabetic', 'custom')),
ADD COLUMN room_nomenclature_prefix VARCHAR(10) DEFAULT '',
ADD COLUMN room_nomenclature_start INTEGER DEFAULT 101,
ADD COLUMN room_nomenclature_examples TEXT;

-- Comments
COMMENT ON COLUMN property_type_rooms.default_bath_towels IS 'Bath towels (toallas de baño)';
COMMENT ON COLUMN property_type_rooms.default_hand_towels IS 'Hand towels (toallas de mano)';
COMMENT ON COLUMN property_type_rooms.default_bath_mats IS 'Bath mats (toallas de piso)';
COMMENT ON COLUMN property_type_rooms.default_standard_pillows IS 'Standard pillows for sleeping';
COMMENT ON COLUMN property_type_rooms.default_decorative_pillows IS 'Decorative pillows';

COMMENT ON COLUMN property_types.room_count IS 'Number of physical units of this type';
COMMENT ON COLUMN property_types.room_nomenclature_type IS 'How rooms are numbered: numeric (101,102), alphabetic (A,B,C), or custom';
COMMENT ON COLUMN property_types.room_nomenclature_prefix IS 'Prefix for room numbers (e.g., "APT-", "CASA-")';
COMMENT ON COLUMN property_types.room_nomenclature_start IS 'Starting number for numeric nomenclature';
COMMENT ON COLUMN property_types.room_nomenclature_examples IS 'Example room names for this type';
