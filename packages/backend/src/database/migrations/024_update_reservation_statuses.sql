-- Update reservation statuses to include new states

-- Step 1: Drop the old constraint first
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;

-- Step 2: Update any 'completed' status to 'checked_out'
UPDATE reservations SET status = 'checked_out' WHERE status = 'completed';

-- Step 3: Add new constraint with updated statuses
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('active', 'cancelled', 'no_show', 'checked_in', 'checked_out'));
