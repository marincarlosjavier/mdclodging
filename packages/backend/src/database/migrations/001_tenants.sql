-- TENANTS TABLE (Multi-tenancy support)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    plan_type VARCHAR(50) DEFAULT 'basic' CHECK (plan_type IN ('basic', 'pro', 'enterprise')),
    max_users INTEGER DEFAULT 10,
    max_tasks_per_month INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for subdomain lookup
CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_is_active ON tenants(is_active);

-- Add comments
COMMENT ON TABLE tenants IS 'Multi-tenant hotels/organizations';
COMMENT ON COLUMN tenants.subdomain IS 'Unique subdomain for tenant access (e.g., hotel1.mdclodging.com)';
COMMENT ON COLUMN tenants.plan_type IS 'Subscription plan type';
COMMENT ON COLUMN tenants.max_users IS 'Maximum users allowed for this tenant';
COMMENT ON COLUMN tenants.max_tasks_per_month IS 'Maximum tasks per month for this tenant';
