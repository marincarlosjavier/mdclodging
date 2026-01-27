-- Add 'skater' role to valid roles
-- Skater is a role for delivery/runner staff

-- Drop existing constraint
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with skater role
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (
    role IS NOT NULL AND
    array_length(role, 1) > 0 AND
    role <@ ARRAY['admin', 'supervisor', 'housekeeping', 'maintenance', 'skater']::text[]
  );

-- Update comment
COMMENT ON COLUMN users.role IS 'User roles array: can have multiple roles from [admin, supervisor, housekeeping, maintenance, skater]';
