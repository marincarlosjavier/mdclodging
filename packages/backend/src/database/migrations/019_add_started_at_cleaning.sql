-- Add started_at field to differentiate when task is accepted vs when work actually starts

ALTER TABLE cleaning_tasks
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_started ON cleaning_tasks(started_at);

COMMENT ON COLUMN cleaning_tasks.assigned_at IS 'When staff member accepted/took the task';
COMMENT ON COLUMN cleaning_tasks.started_at IS 'When staff member actually started the cleaning work';
COMMENT ON COLUMN cleaning_tasks.completed_at IS 'When staff member finished the cleaning work';

-- Metrics can be calculated as:
-- Response time: started_at - checkout_reported_at (how long until they start after checkout)
-- Work duration: completed_at - started_at (how long the cleaning took)
