-- TELEGRAM_CONTACTS TABLE (with multi-tenancy)
CREATE TABLE IF NOT EXISTS telegram_contacts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone_number VARCHAR(50),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    linked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    login_pin VARCHAR(255),
    last_interaction_at TIMESTAMP,
    total_messages INTEGER DEFAULT 0,
    language_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(telegram_id)
);

-- Create indexes
CREATE INDEX idx_telegram_contacts_tenant_id ON telegram_contacts(tenant_id);
CREATE INDEX idx_telegram_contacts_telegram_id ON telegram_contacts(telegram_id);
CREATE INDEX idx_telegram_contacts_user_id ON telegram_contacts(user_id);
CREATE INDEX idx_telegram_contacts_is_active ON telegram_contacts(is_active);

-- Add comments
COMMENT ON TABLE telegram_contacts IS 'Telegram users and their system account linkage';
COMMENT ON COLUMN telegram_contacts.tenant_id IS 'Tenant assigned after linking with user';
COMMENT ON COLUMN telegram_contacts.telegram_id IS 'Unique Telegram user ID';
COMMENT ON COLUMN telegram_contacts.user_id IS 'Linked system user (NULL if not linked yet)';
COMMENT ON COLUMN telegram_contacts.login_pin IS 'Hashed 4-digit PIN for quick login';
COMMENT ON COLUMN telegram_contacts.total_messages IS 'Total messages exchanged with bot';
