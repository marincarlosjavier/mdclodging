-- Create properties table for individual property instances
-- Each property is an instance of a property_type (e.g., Apto 101, 102, 103)

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning', 'reserved')),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);

-- Add comments
COMMENT ON TABLE properties IS 'Individual property instances (apartments/rooms) based on property types';
COMMENT ON COLUMN properties.property_type_id IS 'References the property type configuration';
COMMENT ON COLUMN properties.name IS 'Individual property name (e.g., Apto 101, Habitacion 205)';
COMMENT ON COLUMN properties.status IS 'Current status: available, occupied, maintenance, cleaning, reserved';
