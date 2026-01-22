-- SYSTEM_SETTINGS TABLE (per-tenant configuration)
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, setting_key)
);

-- Create indexes
CREATE INDEX idx_system_settings_tenant_id ON system_settings(tenant_id);
CREATE INDEX idx_system_settings_setting_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_is_public ON system_settings(is_public);

-- Add comments
COMMENT ON TABLE system_settings IS 'Tenant-specific configuration settings';
COMMENT ON COLUMN system_settings.setting_key IS 'Configuration key (e.g., telegram_bot_enabled)';
COMMENT ON COLUMN system_settings.setting_value IS 'Configuration value (stored as text)';
COMMENT ON COLUMN system_settings.setting_type IS 'Data type for proper parsing';
COMMENT ON COLUMN system_settings.is_public IS 'Whether setting can be accessed by non-admin users';
