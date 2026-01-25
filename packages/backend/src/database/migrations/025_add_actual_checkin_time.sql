-- Add actual_checkin_time field to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS actual_checkin_time TIME;
