-- Tabla de tarifas
CREATE TABLE IF NOT EXISTS maintenance_rates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('maintenance', 'inspection', 'repair', 'other')),
    rate DECIMAL(10,2) NOT NULL CHECK (rate >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, property_type_id, task_type)
);

-- Tabla de liquidaciones
CREATE TABLE IF NOT EXISTS maintenance_settlements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),
    submitted_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id, settlement_date)
);

-- Tabla de items
CREATE TABLE IF NOT EXISTS maintenance_settlement_items (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES maintenance_settlements(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    property_name VARCHAR(255),
    property_type_name VARCHAR(255),
    task_type VARCHAR(50) NOT NULL,
    task_title VARCHAR(255),
    rate DECIMAL(10,2) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    work_duration_minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id)
);

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS maintenance_payments (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES maintenance_settlements(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),
    reference_number VARCHAR(100),
    notes TEXT,
    paid_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_maintenance_rates_tenant ON maintenance_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_settlements_tenant ON maintenance_settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_settlements_date ON maintenance_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_settlements_status ON maintenance_settlements(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_settlement_items_settlement ON maintenance_settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_settlement_items_task ON maintenance_settlement_items(task_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_payments_settlement ON maintenance_payments(settlement_id);
