-- TASK_HISTORY TABLE (audit trail for task changes)
CREATE TABLE IF NOT EXISTS task_history (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'updated', 'status_changed', 'assigned', 'completed', 'cancelled')),
    old_value JSONB,
    new_value JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_task_history_tenant_id ON task_history(tenant_id);
CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_changed_by ON task_history(changed_by);
CREATE INDEX idx_task_history_change_type ON task_history(change_type);
CREATE INDEX idx_task_history_created_at ON task_history(created_at);

-- Add comments
COMMENT ON TABLE task_history IS 'Audit trail for all task changes';
COMMENT ON COLUMN task_history.change_type IS 'Type of change made to the task';
COMMENT ON COLUMN task_history.old_value IS 'Previous values (JSON)';
COMMENT ON COLUMN task_history.new_value IS 'New values (JSON)';
