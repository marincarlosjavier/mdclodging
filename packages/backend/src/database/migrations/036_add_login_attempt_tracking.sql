-- Add login attempt tracking and account lockout fields to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP;

-- Create index for performance on lockout queries
CREATE INDEX IF NOT EXISTS idx_users_account_locked ON users(account_locked_until);

-- Add comments for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked_until IS 'Account is locked until this timestamp. NULL means not locked.';
COMMENT ON COLUMN users.last_failed_login_at IS 'Timestamp of the last failed login attempt';
