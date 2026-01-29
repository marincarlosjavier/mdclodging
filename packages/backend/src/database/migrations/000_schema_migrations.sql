-- Schema Migrations Tracking Table
-- This table keeps track of which migrations have been executed
-- to prevent re-running migrations and ensure safe deployments

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at
ON schema_migrations(executed_at DESC);

-- Log that this migration was created
COMMENT ON TABLE schema_migrations IS 'Tracks executed database migrations to prevent duplicate runs';
