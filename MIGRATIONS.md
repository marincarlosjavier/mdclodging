# Sistema de Migraciones MDCLodging

## ¿Qué es y por qué existe?

Este sistema asegura que los cambios en la base de datos:
- ✅ Se ejecuten **una sola vez**
- ✅ **No afecten datos existentes** de los tenants
- ✅ Se puedan **aplicar de forma segura** en producción
- ✅ Tengan **tracking** de cuándo y cómo se ejecutaron

## Cómo Funciona

### 1. Tabla de Tracking
Existe una tabla `schema_migrations` que registra:
- `version`: Nombre del archivo de migración (ej: `001_tenants.sql`)
- `executed_at`: Cuándo se ejecutó
- `execution_time_ms`: Cuánto tardó
- `checksum`: Hash del contenido para detectar cambios

### 2. Proceso Automático
Cada vez que haces deploy o corres migraciones:

```bash
npm run migrate
```

El sistema:
1. Lee todos los archivos `.sql` en `src/database/migrations/`
2. Verifica cuáles YA fueron ejecutados (busca en `schema_migrations`)
3. Ejecuta SOLO los nuevos
4. Registra cada migración ejecutada

### 3. Detección de Cambios
Si modificas una migración que ya se ejecutó, el sistema:
- ⚠️ Detecta que el checksum cambió
- ⚠️ Muestra una advertencia
- 🔄 Re-ejecuta la migración (útil para desarrollo)

## Crear una Nueva Migración

### Paso 1: Nombrar el archivo correctamente
Formato: `###_descripcion.sql`

Ejemplo:
```
042_add_pricing_tiers.sql
043_create_invoices_table.sql
```

**IMPORTANTE:** El número debe ser secuencial y mayor que el último.

### Paso 2: Escribir SQL seguro

```sql
-- Buenas prácticas:

-- 1. Usar IF NOT EXISTS
CREATE TABLE IF NOT EXISTS new_table (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL
);

-- 2. Agregar columnas con DEFAULT para datos existentes
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS wifi_password VARCHAR(255) DEFAULT '';

-- 3. Agregar tenant_id a nuevas tablas multi-tenant
CREATE TABLE features (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

-- 4. Crear índices con IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_properties_tenant
ON properties(tenant_id);

-- 5. Insertar datos seed de forma segura
INSERT INTO catalog_amenities (name, icon)
VALUES ('Pool', '🏊')
ON CONFLICT (name) DO NOTHING;
```

### Paso 3: Testear localmente

```bash
# En desarrollo con docker-compose corriendo:
cd packages/backend
npm run migrate
```

Verifica que:
- ✅ La migración se ejecuta sin errores
- ✅ Puedes correrla múltiples veces (idempotente)
- ✅ No borra datos existentes

### Paso 4: Hacer commit y push

```bash
git add packages/backend/src/database/migrations/042_add_pricing_tiers.sql
git commit -m "Add pricing tiers migration"
git push origin master
```

La migración se ejecutará automáticamente en:
- CI Pipeline (tests)
- Deploy a Staging
- Deploy a Producción

## Comandos Útiles

### Ejecutar migraciones manualmente
```bash
npm run migrate
```

### Ver migraciones ejecutadas (en producción)
```bash
ssh deploy@161.35.134.50
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "SELECT * FROM schema_migrations ORDER BY executed_at DESC;"
```

### Verificar que una migración se ejecutó
```bash
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "SELECT version, executed_at, execution_time_ms FROM schema_migrations WHERE version = '042_add_pricing_tiers.sql';"
```

## Errores Comunes

### ❌ "Migration failed: relation already exists"
**Causa:** La migración no usa `IF NOT EXISTS`

**Solución:**
```sql
-- Mal
CREATE TABLE features (...);

-- Bien
CREATE TABLE IF NOT EXISTS features (...);
```

### ❌ "Migration failed: column already exists"
**Causa:** La columna ya existe de una ejecución anterior

**Solución:**
```sql
-- Usar DO block para verificar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='properties' AND column_name='wifi_password'
    ) THEN
        ALTER TABLE properties ADD COLUMN wifi_password VARCHAR(255);
    END IF;
END $$;
```

### ❌ WARNING: Checksum changed
**Causa:** Modificaste una migración que ya se ejecutó

**Qué hacer:**
- En desarrollo: Normal, se re-ejecuta automáticamente
- En producción: **PELIGROSO** - puede causar errores

**Solución para producción:**
Si REALMENTE necesitas cambiar una migración ejecutada:
1. Crea una NUEVA migración que haga el cambio
2. NO modifiques la original

```sql
-- NO hagas esto:
-- Editar 042_add_pricing_tiers.sql

-- Haz esto:
-- Crear 050_fix_pricing_tiers.sql
ALTER TABLE pricing_tiers
ALTER COLUMN price SET NOT NULL;
```

## Migración Segura para Multi-Tenancy

### ⚠️ SIEMPRE agregar tenant_id a nuevas tablas
```sql
CREATE TABLE IF NOT EXISTS new_feature (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    data TEXT
);

-- Agregar índice para performance
CREATE INDEX IF NOT EXISTS idx_new_feature_tenant
ON new_feature(tenant_id);
```

### ⚠️ NUNCA borres datos de producción
```sql
-- ❌ MAL - Borra datos de todos los tenants
DELETE FROM old_table;

-- ✅ BIEN - Migra datos primero
INSERT INTO new_table (tenant_id, data)
SELECT tenant_id, old_data FROM old_table;

-- Luego en una migración futura (después de verificar):
-- DROP TABLE IF EXISTS old_table;
```

### ⚠️ Usa transacciones para cambios complejos
```sql
BEGIN;

-- Crear nueva tabla
CREATE TABLE new_structure (...);

-- Migrar datos
INSERT INTO new_structure SELECT ...;

-- Verificar
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_count FROM old_table;
    SELECT COUNT(*) INTO new_count FROM new_structure;

    IF old_count != new_count THEN
        RAISE EXCEPTION 'Data migration failed: counts do not match';
    END IF;
END $$;

COMMIT;
```

## Checklist para Nueva Migración

Antes de hacer push, verifica:

- [ ] Nombre de archivo secuencial (ej: `042_descripcion.sql`)
- [ ] Usa `IF NOT EXISTS` en CREATE TABLE/INDEX
- [ ] Agrega `tenant_id` si es tabla multi-tenant
- [ ] Incluye `ON DELETE CASCADE` en foreign keys
- [ ] Probaste la migración localmente
- [ ] La migración es idempotente (puede correrse múltiples veces)
- [ ] NO borra datos existentes
- [ ] Incluye comentarios explicativos

## Arquitectura del Sistema

```
packages/backend/src/database/
├── migrate.js                 # Script principal
├── migrations/                # Todas las migraciones
│   ├── 000_schema_migrations.sql
│   ├── 001_tenants.sql
│   ├── 002_users.sql
│   ├── ...
│   └── 042_add_pricing_tiers.sql
└── config/database.js        # Configuración DB
```

### Flujo de Ejecución

```
1. npm run migrate
   ↓
2. ensureMigrationTable()
   - Crea schema_migrations si no existe
   ↓
3. getExecutedMigrations()
   - Lee versiones ya ejecutadas de la BD
   ↓
4. Para cada archivo .sql en migrations/:
   ↓
5. calculateChecksum(file)
   - Genera hash SHA-256 del contenido
   ↓
6. ¿Ya ejecutada?
   ├─ Sí: ¿Checksum igual?
   │  ├─ Sí: Skip (ya ejecutada)
   │  └─ No: Warning + Re-ejecutar
   └─ No: Ejecutar migración
      ↓
7. recordMigration()
   - Guardar en schema_migrations
   ↓
8. Siguiente archivo...
```

## Monitoreo en Producción

### Ver últimas 10 migraciones ejecutadas
```bash
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "
SELECT
    version,
    executed_at,
    execution_time_ms || 'ms' as duration
FROM schema_migrations
ORDER BY executed_at DESC
LIMIT 10;
"
```

### Verificar total de migraciones
```bash
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "
SELECT COUNT(*) as total_migrations FROM schema_migrations;
"
```

### Ver migraciones lentas (>1000ms)
```bash
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "
SELECT version, execution_time_ms || 'ms' as duration
FROM schema_migrations
WHERE execution_time_ms > 1000
ORDER BY execution_time_ms DESC;
"
```

## Recursos Adicionales

- **Código fuente**: `packages/backend/src/database/migrate.js`
- **Migraciones**: `packages/backend/src/database/migrations/`
- **Workflows**: `.github/workflows/deploy-production.yml`

## Soporte

Si tienes problemas con migraciones:
1. Revisa los logs del deploy en GitHub Actions
2. Verifica `docker logs mdclodging_backend` en producción
3. Consulta la tabla `schema_migrations` para ver qué se ejecutó

---

**✨ Sistema creado para MDCLodging SaaS - Versión 1.0**
