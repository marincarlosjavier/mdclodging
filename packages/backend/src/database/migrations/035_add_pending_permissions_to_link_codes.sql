-- Add pending_permissions to telegram_link_codes
-- This stores the permissions that will be assigned when the user links their account

ALTER TABLE telegram_link_codes
ADD COLUMN pending_permissions INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN telegram_link_codes.pending_permissions IS 'Array of permission IDs from telegram_permissions_catalog to be assigned upon linking';
