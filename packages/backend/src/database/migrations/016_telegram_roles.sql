-- ADD TELEGRAM ROLES TO CONTACTS TABLE
-- Separate from system roles (admin, supervisor, etc.)

-- Add telegram_roles column
ALTER TABLE telegram_contacts
  ADD COLUMN telegram_roles text[] DEFAULT ARRAY[]::text[];

-- Add constraint to ensure valid telegram roles
ALTER TABLE telegram_contacts
  ADD CONSTRAINT telegram_contacts_telegram_roles_check CHECK (
    telegram_roles <@ ARRAY['view_tasks', 'update_tasks', 'claim_tasks', 'complete_tasks', 'receive_notifications']::text[]
  );

-- Create index for telegram roles
CREATE INDEX idx_telegram_contacts_telegram_roles ON telegram_contacts USING GIN(telegram_roles);

-- Set default roles for existing linked contacts
UPDATE telegram_contacts
  SET telegram_roles = ARRAY['view_tasks', 'update_tasks', 'claim_tasks', 'complete_tasks']::text[]
  WHERE user_id IS NOT NULL AND linked_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN telegram_contacts.telegram_roles IS 'Telegram-specific roles: view_tasks, update_tasks, claim_tasks, complete_tasks, receive_notifications';
