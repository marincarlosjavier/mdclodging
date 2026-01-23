-- Add checkout_time field to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checkout_time TIME;

-- Add index for checkout_time
CREATE INDEX IF NOT EXISTS idx_reservations_checkout_time ON reservations(checkout_time);

-- Comment
COMMENT ON COLUMN reservations.checkout_time IS 'Expected checkout time reported by guest for housekeeping scheduling';
