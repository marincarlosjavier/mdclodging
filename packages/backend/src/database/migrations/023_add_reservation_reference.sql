-- Add reference field to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS reference VARCHAR(255);

-- Create index for faster searches by reference
CREATE INDEX IF NOT EXISTS idx_reservations_reference ON reservations(reference);

-- Add comment
COMMENT ON COLUMN reservations.reference IS 'Reference identifier for the reservation (guest name, booking number, etc.)';
