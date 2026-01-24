-- Add session tracking fields to telegram_contacts
ALTER TABLE telegram_contacts
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_logged_in BOOLEAN DEFAULT false;

-- Add session timeout configuration to tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS telegram_session_timeout_hours INTEGER DEFAULT 8;

COMMENT ON COLUMN telegram_contacts.last_login_at IS 'Last time user authenticated with PIN';
COMMENT ON COLUMN telegram_contacts.is_logged_in IS 'Whether user is currently logged in (not expired)';
COMMENT ON COLUMN tenants.telegram_session_timeout_hours IS 'Hours before Telegram session expires and requires re-authentication';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_telegram_contacts_login ON telegram_contacts(last_login_at, is_logged_in);
