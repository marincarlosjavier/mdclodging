-- Seed catalog with hierarchical locations for Colombia
-- This helps users get started quickly with common locations
-- Structure: Department -> City -> Zone

-- Note: tenant_id = 1 is assumed to be the demo tenant
-- Adjust as needed for your setup

-- Step 1: Departments (Departamentos) - No parent
INSERT INTO catalog_items (tenant_id, category, type, name, description, parent_id) VALUES
(1, 'location', 'department', 'Cesar', 'Departamento del Cesar', NULL),
(1, 'location', 'department', 'La Guajira', 'Departamento de La Guajira', NULL),
(1, 'location', 'department', 'Magdalena', 'Departamento del Magdalena', NULL)
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;

-- Step 2: Cities (Ciudades) - Belong to departments
-- Get department IDs first
WITH dept_cesar AS (
  SELECT id FROM catalog_items WHERE tenant_id = 1 AND type = 'department' AND name = 'Cesar' LIMIT 1
),
dept_guajira AS (
  SELECT id FROM catalog_items WHERE tenant_id = 1 AND type = 'department' AND name = 'La Guajira' LIMIT 1
),
dept_magdalena AS (
  SELECT id FROM catalog_items WHERE tenant_id = 1 AND type = 'department' AND name = 'Magdalena' LIMIT 1
)
INSERT INTO catalog_items (tenant_id, category, type, name, description, parent_id)
SELECT 1, 'location', 'city', 'Valledupar', 'Capital del Cesar', id FROM dept_cesar
UNION ALL
SELECT 1, 'location', 'city', 'Riohacha', 'Capital de La Guajira', id FROM dept_guajira
UNION ALL
SELECT 1, 'location', 'city', 'Santa Marta', 'Capital del Magdalena', id FROM dept_magdalena
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;

-- Step 3: Zones/Buildings - Belong to cities
-- Get city IDs
WITH city_valledupar AS (
  SELECT id FROM catalog_items WHERE tenant_id = 1 AND type = 'city' AND name = 'Valledupar' LIMIT 1
),
city_riohacha AS (
  SELECT id FROM catalog_items WHERE tenant_id = 1 AND type = 'city' AND name = 'Riohacha' LIMIT 1
)
INSERT INTO catalog_items (tenant_id, category, type, name, description, parent_id)
SELECT 1, 'location', 'zone', 'Edificio Villa Olímpica', 'Edificio residencial en Valledupar', id FROM city_valledupar
UNION ALL
SELECT 1, 'location', 'zone', 'Edificio Las Delicias', 'Edificio residencial en Riohacha', id FROM city_riohacha
UNION ALL
SELECT 1, 'location', 'zone', 'Edificio El Coral', 'Edificio residencial en Riohacha', id FROM city_riohacha
UNION ALL
SELECT 1, 'location', 'zone', 'Centro Histórico', 'Zona del centro histórico de Valledupar', id FROM city_valledupar
ON CONFLICT (tenant_id, category, type, name, parent_id) DO NOTHING;
