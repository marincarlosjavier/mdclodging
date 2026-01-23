-- Enhanced checkout workflow with timer tracking and staff assignment

-- Add actual_checkout_time to reservations (when guest reports checkout)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS actual_checkout_time TIMESTAMP;

-- Add checkout tracking fields to cleaning_tasks
ALTER TABLE cleaning_tasks
ADD COLUMN IF NOT EXISTS checkout_reported_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_reservations_actual_checkout ON reservations(actual_checkout_time);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_checkout_reported ON cleaning_tasks(checkout_reported_at);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_assigned_to ON cleaning_tasks(assigned_to);

-- Comments
COMMENT ON COLUMN reservations.actual_checkout_time IS 'Actual time when guest reported checkout (called front desk)';
COMMENT ON COLUMN cleaning_tasks.checkout_reported_at IS 'Timestamp when checkout was reported - used for timer calculation';
COMMENT ON COLUMN cleaning_tasks.assigned_to IS 'User ID of staff member who took the cleaning task';
COMMENT ON COLUMN cleaning_tasks.assigned_at IS 'Timestamp when staff member accepted the task';
