-- Add cleaning count to properties table for deep cleaning scheduling
ALTER TABLE properties
ADD COLUMN cleaning_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN properties.cleaning_count IS 'Counter for completed check_out cleanings, used to schedule deep_cleaning tasks';
