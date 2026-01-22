-- TASKS TABLE (with multi-tenancy)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(50) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    task_type VARCHAR(50) NOT NULL
        CHECK (task_type IN ('cleaning', 'maintenance', 'inspection', 'other')),
    location VARCHAR(255) NOT NULL,
    room_number VARCHAR(50),
    due_date TIMESTAMP,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    completed_at TIMESTAMP,
    started_at TIMESTAMP,
    notes TEXT,
    estimated_duration INTEGER,
    actual_duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_location ON tasks(location);
CREATE INDEX idx_tasks_tenant_status ON tasks(tenant_id, status);

-- Add comments
COMMENT ON TABLE tasks IS 'Tasks for housekeeping and maintenance';
COMMENT ON COLUMN tasks.tenant_id IS 'Reference to tenant (hotel)';
COMMENT ON COLUMN tasks.location IS 'General location (e.g., Floor 2, Lobby, etc.)';
COMMENT ON COLUMN tasks.room_number IS 'Specific room number if applicable';
COMMENT ON COLUMN tasks.estimated_duration IS 'Estimated time in minutes';
COMMENT ON COLUMN tasks.actual_duration IS 'Actual time taken in minutes';
