-- TASK_PHOTOS TABLE (with multi-tenancy)
CREATE TABLE IF NOT EXISTS task_photos (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    photo_url VARCHAR(500) NOT NULL,
    photo_type VARCHAR(50) NOT NULL CHECK (photo_type IN ('before', 'after', 'during')),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    file_size INTEGER,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    telegram_file_id VARCHAR(255),
    telegram_file_unique_id VARCHAR(255),
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_task_photos_tenant_id ON task_photos(tenant_id);
CREATE INDEX idx_task_photos_task_id ON task_photos(task_id);
CREATE INDEX idx_task_photos_photo_type ON task_photos(photo_type);
CREATE INDEX idx_task_photos_uploaded_by ON task_photos(uploaded_by);
CREATE INDEX idx_task_photos_telegram_file_id ON task_photos(telegram_file_id);

-- Add comments
COMMENT ON TABLE task_photos IS 'Photos attached to tasks (before/after/during)';
COMMENT ON COLUMN task_photos.tenant_id IS 'Reference to tenant (hotel)';
COMMENT ON COLUMN task_photos.photo_type IS 'When photo was taken: before, during, or after task';
COMMENT ON COLUMN task_photos.telegram_file_id IS 'Telegram file ID for future reference';
COMMENT ON COLUMN task_photos.telegram_file_unique_id IS 'Unique Telegram file identifier';
