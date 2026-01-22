-- Create catalog_items table for reusable lists

CREATE TABLE IF NOT EXISTS catalog_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,  -- 'location', 'kitchen', 'living_room', 'bedroom', etc.
    type VARCHAR(50) NOT NULL,      -- 'department', 'city', 'zone', 'utensil', 'furniture', etc.
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES catalog_items(id) ON DELETE CASCADE,  -- For hierarchical relationships
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, category, type, name, parent_id)
);

-- Indexes
CREATE INDEX idx_catalog_items_tenant ON catalog_items(tenant_id);
CREATE INDEX idx_catalog_items_category ON catalog_items(category);
CREATE INDEX idx_catalog_items_type ON catalog_items(type);
CREATE INDEX idx_catalog_items_parent ON catalog_items(parent_id);

-- Comments
COMMENT ON TABLE catalog_items IS 'Reusable catalog items for consistent data entry';
COMMENT ON COLUMN catalog_items.category IS 'Category of the item (location, kitchen, living_room, bedroom, etc.)';
COMMENT ON COLUMN catalog_items.type IS 'Specific type within category (department, city, zone, utensil, etc.)';
COMMENT ON COLUMN catalog_items.name IS 'Name of the catalog item';
COMMENT ON COLUMN catalog_items.parent_id IS 'Parent item ID for hierarchical relationships (e.g., city belongs to department)';
