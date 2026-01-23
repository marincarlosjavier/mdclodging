-- MODIFY USERS TABLE TO SUPPORT MULTIPLE ROLES
-- Change role from VARCHAR to text array

-- First, convert existing single roles to arrays
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- Add temporary column for new roles
ALTER TABLE users
  ADD COLUMN roles text[];

-- Copy existing role to roles array
UPDATE users
  SET roles = ARRAY[role]::text[]
  WHERE role IS NOT NULL;

-- Drop old role column
ALTER TABLE users
  DROP COLUMN role;

-- Rename roles to role (keep same column name for backwards compatibility)
ALTER TABLE users
  RENAME COLUMN roles TO role;

-- Add constraint to ensure valid roles
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (
    role IS NOT NULL AND
    array_length(role, 1) > 0 AND
    role <@ ARRAY['admin', 'supervisor', 'housekeeping', 'maintenance']::text[]
  );

-- Update index
DROP INDEX IF EXISTS idx_users_role;
CREATE INDEX idx_users_role ON users USING GIN(role);

-- Add comment
COMMENT ON COLUMN users.role IS 'User roles array: can have multiple roles from [admin, supervisor, housekeeping, maintenance]';
