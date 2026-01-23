-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Check-in/out dates
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,

    -- Guest information
    adults INTEGER DEFAULT 1 CHECK (adults >= 0),
    children INTEGER DEFAULT 0 CHECK (children >= 0),
    infants INTEGER DEFAULT 0 CHECK (infants >= 0),

    -- Services
    has_breakfast BOOLEAN DEFAULT false,

    -- Additional info
    additional_requirements TEXT,
    notes TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cleaning_tasks table
CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,

    -- Task details
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('check_out', 'stay_over', 'deep_cleaning')),
    scheduled_date DATE NOT NULL,

    -- Assignment and status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Notes and completion
    notes TEXT,
    completed_at TIMESTAMP,
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add cleaning settings to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS stay_over_interval INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS deep_cleaning_interval INTEGER DEFAULT 30;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_tenant ON cleaning_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_property ON cleaning_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_scheduled_date ON cleaning_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_status ON cleaning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_assigned ON cleaning_tasks(assigned_to);

-- Comments
COMMENT ON TABLE reservations IS 'Guest reservations and check-ins';
COMMENT ON TABLE cleaning_tasks IS 'Housekeeping tasks (check-out, stay-over, deep cleaning)';
COMMENT ON COLUMN cleaning_tasks.task_type IS 'check_out: full cleaning after checkout, stay_over: daily/light cleaning, deep_cleaning: scheduled deep clean';
COMMENT ON COLUMN tenants.stay_over_interval IS 'Days between stay-over cleanings (default 3)';
COMMENT ON COLUMN tenants.deep_cleaning_interval IS 'Days between deep cleanings (default 30)';
