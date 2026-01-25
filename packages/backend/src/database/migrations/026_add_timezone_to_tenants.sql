-- Add timezone configuration to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Bogota';

COMMENT ON COLUMN tenants.timezone IS 'Timezone identifier (e.g., America/Bogota, America/New_York)';
