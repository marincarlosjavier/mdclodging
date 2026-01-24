-- Add checkin_time field to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS checkin_time TIME DEFAULT '15:00';

COMMENT ON COLUMN reservations.checkin_time IS 'Scheduled check-in time (default 3:00 PM)';
COMMENT ON COLUMN reservations.checkout_time IS 'Scheduled check-out time (default 12:00 PM)';
