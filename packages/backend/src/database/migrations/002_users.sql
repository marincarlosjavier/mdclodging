-- USERS TABLE (with multi-tenancy)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'supervisor', 'housekeeping', 'maintenance')),
    is_active BOOLEAN DEFAULT true,
    api_token VARCHAR(255) UNIQUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- Create indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_token ON users(api_token);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Add comments
COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON COLUMN users.tenant_id IS 'Reference to tenant (hotel/organization)';
COMMENT ON COLUMN users.role IS 'User role: admin (full access), supervisor (manage tasks), housekeeping/maintenance (execute tasks)';
COMMENT ON COLUMN users.api_token IS 'Token for API authentication (external integrations)';
