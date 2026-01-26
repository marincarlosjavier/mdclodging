-- Update deep_cleaning_interval to reflect new logic (reservation count instead of days)
ALTER TABLE tenants
ALTER COLUMN deep_cleaning_interval SET DEFAULT 11;

COMMENT ON COLUMN tenants.deep_cleaning_interval IS 'Number of check_out cleanings before scheduling a deep_cleaning (default: 11)';

-- Update existing tenants to use new default if they have the old default
UPDATE tenants SET deep_cleaning_interval = 11 WHERE deep_cleaning_interval = 30;
