-- Create properties table for individual property instances
-- Each property is an instance of a property_type (e.g., "Apto 101" is instance of "Apartamento Estándar")

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_type_id INTEGER NOT NULL REFERENCES property_types(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,                     -- "Apto 101", "Habitación 201", "Casa Vista Mar", etc.
    status VARCHAR(50) DEFAULT 'available'          -- 'available', 'occupied', 'maintenance', 'cleaning', 'reserved'
        CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning', 'reserved')),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

-- Indexes for better performance
CREATE INDEX idx_properties_tenant ON properties(tenant_id);
CREATE INDEX idx_properties_type ON properties(property_type_id);
CREATE INDEX idx_properties_status ON properties(status);

-- Comments
COMMENT ON TABLE properties IS 'Individual property instances (apartments, rooms, houses)';
COMMENT ON COLUMN properties.name IS 'Unique identifier for the property (e.g., "Apto 101", "Casa Vista Mar")';
COMMENT ON COLUMN properties.status IS 'Current operational status of the property';
