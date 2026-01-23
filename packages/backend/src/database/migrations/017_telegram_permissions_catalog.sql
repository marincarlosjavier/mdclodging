-- CREATE TELEGRAM PERMISSIONS CATALOG
-- Predefined permissions that can be assigned to users

CREATE TABLE IF NOT EXISTS telegram_permissions_catalog (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default permissions
INSERT INTO telegram_permissions_catalog (code, name, description, permissions) VALUES
('admin', 'Admin Telegram', 'Ver resultados y puede generar órdenes de mantenimiento',
 '{"can_view_all_tasks": true, "can_generate_maintenance_orders": true, "can_view_reports": true, "can_assign_tasks": true}'::jsonb),
('housekeeping', 'Housekeeping', 'Todo lo relacionado con limpieza y housekeeping',
 '{"can_view_housekeeping_tasks": true, "can_update_housekeeping_tasks": true, "can_complete_housekeeping_tasks": true}'::jsonb),
('mantenimiento', 'Mantenimiento', 'Todo lo relacionado con mantenimiento',
 '{"can_view_maintenance_tasks": true, "can_update_maintenance_tasks": true, "can_complete_maintenance_tasks": true}'::jsonb),
('concesion', 'Concesión', 'Todo lo relacionado con desayunos, bebidas y snacks',
 '{"can_view_concession_tasks": true, "can_update_breakfast_list": true, "can_manage_inventory": true}'::jsonb);

-- Create junction table for telegram contacts and permissions
CREATE TABLE IF NOT EXISTS telegram_contact_permissions (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL REFERENCES telegram_contacts(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES telegram_permissions_catalog(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    UNIQUE(contact_id, permission_id)
);

-- Create indexes
CREATE INDEX idx_telegram_contact_permissions_contact_id ON telegram_contact_permissions(contact_id);
CREATE INDEX idx_telegram_contact_permissions_permission_id ON telegram_contact_permissions(permission_id);
CREATE INDEX idx_telegram_permissions_catalog_code ON telegram_permissions_catalog(code);

-- Migrate existing telegram_roles to new system
-- Map old roles to new permissions
INSERT INTO telegram_contact_permissions (contact_id, permission_id)
SELECT
    tc.id as contact_id,
    tpc.id as permission_id
FROM telegram_contacts tc
CROSS JOIN telegram_permissions_catalog tpc
WHERE tc.user_id IS NOT NULL
  AND tc.telegram_roles IS NOT NULL
  AND (
    -- If has view_tasks or update_tasks, give housekeeping permission
    (tc.telegram_roles && ARRAY['view_tasks', 'update_tasks']::text[] AND tpc.code = 'housekeeping')
  )
ON CONFLICT (contact_id, permission_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE telegram_permissions_catalog IS 'Catalog of predefined Telegram permissions';
COMMENT ON TABLE telegram_contact_permissions IS 'Junction table linking telegram contacts to permissions';
COMMENT ON COLUMN telegram_permissions_catalog.code IS 'Unique code for permission (admin, housekeeping, mantenimiento, concesion)';
COMMENT ON COLUMN telegram_permissions_catalog.permissions IS 'JSONB with specific capabilities enabled by this permission';
