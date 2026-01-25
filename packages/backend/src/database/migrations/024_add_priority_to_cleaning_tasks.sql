-- Add is_priority field to cleaning_tasks table
ALTER TABLE cleaning_tasks
ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT false;

-- Create index for filtering priority tasks
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_priority ON cleaning_tasks(is_priority) WHERE is_priority = true;

-- Add comment
COMMENT ON COLUMN cleaning_tasks.is_priority IS 'Indicates if this cleaning task is marked as priority/urgent';
