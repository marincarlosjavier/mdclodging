-- Create comprehensive subscription system for SaaS billing
-- Includes: plans, subscriptions, invoices, payment methods, usage tracking

-- ============================================================================
-- SUBSCRIPTION PLANS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly_cop INTEGER NOT NULL,
    price_yearly_cop INTEGER,
    max_users INTEGER NOT NULL,
    max_properties INTEGER NOT NULL,
    max_tasks_per_month INTEGER NOT NULL,
    max_storage_mb INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_name ON subscription_plans(name);

-- Insert default plans (Colombian Pesos - COP)
INSERT INTO subscription_plans
(name, display_name, description, price_monthly_cop, price_yearly_cop, max_users, max_properties, max_tasks_per_month, max_storage_mb, features, sort_order)
VALUES
('trial', 'Prueba Gratuita', 'Prueba gratuita de 14 días para explorar todas las funcionalidades', 0, 0, 2, 5, 100, 100,
 '{"telegram_bot": false, "api_access": false, "priority_support": false, "custom_reports": false}'::jsonb, 1),

('basic', 'Plan Básico', 'Ideal para pequeñas propiedades o administradores independientes', 149000, 1490000, 5, 20, 500, 1000,
 '{"telegram_bot": true, "api_access": false, "priority_support": false, "custom_reports": false, "email_support": true}'::jsonb, 2),

('pro', 'Plan Profesional', 'Para administradores con múltiples propiedades y equipos de trabajo', 349000, 3490000, 15, 50, 2000, 5000,
 '{"telegram_bot": true, "api_access": true, "priority_support": false, "custom_reports": true, "email_support": true, "whatsapp_support": true}'::jsonb, 3),

('enterprise', 'Plan Empresarial', 'Solución completa para grandes empresas de administración', 999000, 9990000, 999, 999, 999999, 50000,
 '{"telegram_bot": true, "api_access": true, "priority_support": true, "custom_reports": true, "email_support": true, "whatsapp_support": true, "phone_support": true, "dedicated_account_manager": true, "custom_integrations": true}'::jsonb, 4)

ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(30) NOT NULL CHECK (status IN
        ('trialing', 'active', 'past_due', 'canceled', 'suspended', 'expired')),
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ============================================================================
-- SUBSCRIPTION HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    old_plan_id INTEGER REFERENCES subscription_plans(id),
    new_plan_id INTEGER REFERENCES subscription_plans(id),
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    reason VARCHAR(100),
    changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_date ON subscription_history(changed_at DESC);

-- ============================================================================
-- INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount_cop INTEGER NOT NULL,
    tax_cop INTEGER NOT NULL DEFAULT 0,
    total_cop INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN
        ('draft', 'open', 'paid', 'void', 'uncollectible')),
    due_date DATE NOT NULL,
    paid_at TIMESTAMP,
    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    pdf_url TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- ============================================================================
-- PAYMENT METHODS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN
        ('card', 'bank_transfer', 'cash', 'other')),
    stripe_payment_method_id VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    last4 VARCHAR(4),
    brand VARCHAR(50),
    exp_month INTEGER,
    exp_year INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(tenant_id, is_default) WHERE is_default = true;

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_tracking (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    value INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_tenant_period ON usage_tracking(tenant_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_metric ON usage_tracking(metric);

-- ============================================================================
-- QUOTA VIOLATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS quota_violations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    quota_type VARCHAR(50) NOT NULL,
    limit_value INTEGER NOT NULL,
    actual_value INTEGER NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quota_violations_tenant ON quota_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quota_violations_detected ON quota_violations(detected_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with pricing and limits';
COMMENT ON TABLE subscriptions IS 'Active subscriptions for each tenant';
COMMENT ON TABLE subscription_history IS 'Audit trail of subscription changes';
COMMENT ON TABLE invoices IS 'Billing invoices for subscriptions';
COMMENT ON TABLE payment_methods IS 'Stored payment methods for tenants';
COMMENT ON TABLE usage_tracking IS 'Track usage metrics for billing and quotas';
COMMENT ON TABLE quota_violations IS 'Log when tenants exceed their plan limits';

COMMENT ON COLUMN subscriptions.status IS 'trialing: in trial period, active: paid and active, past_due: payment failed, canceled: user canceled, suspended: admin suspended, expired: trial/subscription ended';
COMMENT ON COLUMN invoices.tax_cop IS 'IVA (19% in Colombia)';
