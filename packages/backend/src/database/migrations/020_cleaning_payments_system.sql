-- =====================================================
-- SISTEMA DE PAGOS Y LIQUIDACIÓN PARA HOUSEKEEPING
-- =====================================================

-- 1. TABLA DE TARIFAS: Define precios por tipo de aseo y tipo de propiedad
CREATE TABLE IF NOT EXISTS cleaning_rates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('check_out', 'stay_over', 'deep_cleaning')),
    rate DECIMAL(10,2) NOT NULL CHECK (rate >= 0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Una tarifa única por combinación
    UNIQUE(tenant_id, property_type_id, task_type)
);

-- 2. TABLA DE LIQUIDACIONES: Liquidación diaria de housekeeping
CREATE TABLE IF NOT EXISTS cleaning_settlements (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Fecha y período
    settlement_date DATE NOT NULL,

    -- Totales calculados
    total_tasks INTEGER DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,

    -- Flujo de aprobación
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),

    -- Timestamps del flujo
    submitted_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Una liquidación por usuario por día
    UNIQUE(tenant_id, user_id, settlement_date)
);

-- 3. TABLA DE ITEMS DE LIQUIDACIÓN: Detalles de cada liquidación
CREATE TABLE IF NOT EXISTS cleaning_settlement_items (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES cleaning_settlements(id) ON DELETE CASCADE,
    cleaning_task_id INTEGER NOT NULL REFERENCES cleaning_tasks(id) ON DELETE CASCADE,

    -- Snapshot de datos al momento de la liquidación (para histórico)
    property_name VARCHAR(255),
    property_type_name VARCHAR(255),
    task_type VARCHAR(50) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,

    -- Tiempos de trabajo
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    work_duration_minutes INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Cada tarea solo puede estar en una liquidación
    UNIQUE(cleaning_task_id)
);

-- 4. TABLA DE PAGOS: Registro de pagos efectuados
CREATE TABLE IF NOT EXISTS cleaning_payments (
    id SERIAL PRIMARY KEY,
    settlement_id INTEGER NOT NULL REFERENCES cleaning_settlements(id) ON DELETE CASCADE,

    -- Detalles del pago
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),

    -- Referencia y notas
    reference_number VARCHAR(100),
    notes TEXT,

    -- Quién registró el pago
    paid_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_cleaning_rates_tenant ON cleaning_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_rates_property_type ON cleaning_rates(property_type_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_settlements_tenant ON cleaning_settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_settlements_user ON cleaning_settlements(user_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_settlements_date ON cleaning_settlements(settlement_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_settlements_status ON cleaning_settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement ON cleaning_settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_task ON cleaning_settlement_items(cleaning_task_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_payments_settlement ON cleaning_payments(settlement_id);

-- Comentarios explicativos
COMMENT ON TABLE cleaning_rates IS 'Tarifas de pago por tipo de aseo y tipo de propiedad';
COMMENT ON TABLE cleaning_settlements IS 'Liquidaciones diarias de housekeeping staff';
COMMENT ON TABLE cleaning_settlement_items IS 'Detalles de tareas incluidas en cada liquidación';
COMMENT ON TABLE cleaning_payments IS 'Registro de pagos efectuados a housekeeping';

COMMENT ON COLUMN cleaning_rates.rate IS 'Precio en moneda local para este tipo de servicio';
COMMENT ON COLUMN cleaning_settlements.status IS 'draft: en construcción, submitted: reportada, approved: aprobada por admin, rejected: rechazada, paid: pago efectuado';
COMMENT ON COLUMN cleaning_settlement_items.rate IS 'Snapshot del rate aplicado (para histórico en caso de cambios de precio)';
COMMENT ON COLUMN cleaning_settlement_items.work_duration_minutes IS 'Duración del trabajo en minutos (completed_at - started_at)';
