-- TELEGRAM_LINK_CODES TABLE (for linking Telegram accounts)
CREATE TABLE IF NOT EXISTS telegram_link_codes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    used_by_telegram_id BIGINT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code)
);

-- Create indexes
CREATE INDEX idx_telegram_link_codes_tenant_id ON telegram_link_codes(tenant_id);
CREATE INDEX idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);
CREATE INDEX idx_telegram_link_codes_code ON telegram_link_codes(code);
CREATE INDEX idx_telegram_link_codes_expires_at ON telegram_link_codes(expires_at);
CREATE INDEX idx_telegram_link_codes_used ON telegram_link_codes(used);

-- Add comments
COMMENT ON TABLE telegram_link_codes IS 'One-time codes for linking Telegram accounts to system users';
COMMENT ON COLUMN telegram_link_codes.code IS 'Unique 6-8 character code (alphanumeric)';
COMMENT ON COLUMN telegram_link_codes.expires_at IS 'Code expiration timestamp (typically 24 hours)';
COMMENT ON COLUMN telegram_link_codes.used_by_telegram_id IS 'Telegram ID that used this code';
