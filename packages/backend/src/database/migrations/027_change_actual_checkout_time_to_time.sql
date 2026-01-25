-- Change actual_checkout_time from TIMESTAMP to TIME
ALTER TABLE reservations
ALTER COLUMN actual_checkout_time TYPE TIME USING actual_checkout_time::TIME;

COMMENT ON COLUMN reservations.actual_checkout_time IS 'Actual time when guest reported checkout (time only, not full timestamp)';
