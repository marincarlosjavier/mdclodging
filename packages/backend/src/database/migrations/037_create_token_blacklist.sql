-- Create token blacklist table for token revocation
-- This allows immediate invalidation of JWTs even before they expire

CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    token_jti VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reason VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast JTI lookups during authentication
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);

-- Index for cleanup queries (remove expired tokens)
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Index for querying by user (admin purposes)
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user ON token_blacklist(user_id);

-- Comments for documentation
COMMENT ON TABLE token_blacklist IS 'Stores revoked JWT tokens to prevent reuse after logout or forced invalidation';
COMMENT ON COLUMN token_blacklist.token_jti IS 'JWT ID (jti claim) - unique identifier for each token';
COMMENT ON COLUMN token_blacklist.reason IS 'Reason for revocation: logout, password_change, admin_revoke, security_breach';
COMMENT ON COLUMN token_blacklist.expires_at IS 'When the original token would have expired - can be cleaned up after this date';
