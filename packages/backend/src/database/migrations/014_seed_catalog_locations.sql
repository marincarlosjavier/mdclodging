-- Seed catalog with sample locations for Colombia
-- This helps users get started quickly with common locations

-- Note: tenant_id = 1 is assumed to be the demo tenant
-- Adjust as needed for your setup

-- Departments (Departamentos)
INSERT INTO catalog_items (tenant_id, category, type, name, description) VALUES
(1, 'location', 'department', 'Cesar', 'Departamento del Cesar'),
(1, 'location', 'department', 'La Guajira', 'Departamento de La Guajira'),
(1, 'location', 'department', 'Magdalena', 'Departamento del Magdalena'),
(1, 'location', 'department', 'Atlántico', 'Departamento del Atlántico'),
(1, 'location', 'department', 'Bolívar', 'Departamento de Bolívar')
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;

-- Cities (Ciudades)
INSERT INTO catalog_items (tenant_id, category, type, name, description) VALUES
(1, 'location', 'city', 'Valledupar', 'Capital del Cesar'),
(1, 'location', 'city', 'Riohacha', 'Capital de La Guajira'),
(1, 'location', 'city', 'Santa Marta', 'Capital del Magdalena'),
(1, 'location', 'city', 'Barranquilla', 'Capital del Atlántico'),
(1, 'location', 'city', 'Cartagena', 'Capital de Bolívar')
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;

-- Zones/Buildings (example for Valledupar)
INSERT INTO catalog_items (tenant_id, category, type, name, description) VALUES
(1, 'location', 'zone', 'Edificio Villa Olímpica', 'Edificio residencial en Valledupar'),
(1, 'location', 'zone', 'Edificio Las Delicias', 'Edificio residencial'),
(1, 'location', 'zone', 'Edificio El Coral', 'Edificio residencial'),
(1, 'location', 'zone', 'Centro Histórico', 'Zona del centro histórico'),
(1, 'location', 'zone', 'Zona Norte', 'Zona Norte de la ciudad')
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;
