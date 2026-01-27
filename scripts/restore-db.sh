#!/bin/bash
#
# Database Restore Script for MDCLodging
# Restores PostgreSQL database from backup
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_prompt() {
    echo -e "${BLUE}[INPUT]${NC} $1"
}

# Configuration
BACKUP_FILE=$1
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_CONTAINER="${DB_CONTAINER:-mdclodging_postgres}"
DB_NAME="${DB_NAME:-mdclodging}"
DB_USER="${DB_USER:-postgres}"

# Usage
if [ -z "$BACKUP_FILE" ]; then
    log_error "Usage: $0 <backup-file>"
    log_info "Example: $0 /backups/db_20260126_030000.dump.gz"
    echo ""
    log_info "Available backups:"
    ls -lht "$BACKUP_DIR"/db_*.dump* 2>/dev/null | head -10 || log_warn "No backups found in $BACKUP_DIR"
    exit 1
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_warn "========================================="
log_warn "DATABASE RESTORE WARNING"
log_warn "========================================="
log_warn "This will DESTROY the current database!"
log_warn "Database: $DB_NAME"
log_warn "Container: $DB_CONTAINER"
log_warn "Backup: $BACKUP_FILE"
log_warn "========================================="

# Confirmation prompt
read -p "$(echo -e ${BLUE}Are you sure you want to continue? ${NC}[y/N]) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

# Check if Docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log_error "Docker container '$DB_CONTAINER' is not running"
    exit 1
fi

log_info "Starting database restore..."

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Decompress if needed
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup..."
    gunzip -c "$BACKUP_FILE" > "$TEMP_DIR/backup.dump"
    RESTORE_FILE="$TEMP_DIR/backup.dump"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Verify backup file
if ! file "$RESTORE_FILE" | grep -q "PostgreSQL custom database dump"; then
    log_error "Invalid backup file format"
    exit 1
fi

# Stop application to prevent connections
log_info "Stopping backend container..."
docker stop mdclodging_backend 2>/dev/null || true

# Wait for connections to close
sleep 3

# Restore database
log_info "Restoring database..."
log_info "This may take several minutes for large databases..."

if docker exec -i "$DB_CONTAINER" pg_restore \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --verbose \
    < "$RESTORE_FILE" 2>&1 | tee /tmp/restore.log; then
    log_info "Database restored successfully"
else
    # pg_restore returns non-zero even on success sometimes
    if grep -q "ERROR" /tmp/restore.log; then
        log_warn "Restore completed with errors (check /tmp/restore.log)"
    else
        log_info "Database restored successfully"
    fi
fi

# Restart backend
log_info "Restarting backend container..."
docker start mdclodging_backend

# Wait for backend to be healthy
log_info "Waiting for backend to be ready..."
sleep 5

HEALTH_CHECK_ATTEMPTS=12
for i in $(seq 1 $HEALTH_CHECK_ATTEMPTS); do
    if docker exec mdclodging_backend node -e "require('http').get('http://localhost:3000/health')" 2>/dev/null; then
        log_info "Backend is healthy"
        break
    fi

    if [ $i -eq $HEALTH_CHECK_ATTEMPTS ]; then
        log_warn "Backend health check failed, but restore is complete"
        log_warn "Check logs: docker logs mdclodging_backend"
    fi

    sleep 5
done

# Summary
log_info "========================================="
log_info "Restore completed!"
log_info "Backup file: $BACKUP_FILE"
log_info "Database: $DB_NAME"
log_info "========================================="

# Verify restore
log_info "Verifying restore..."
TABLES=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
log_info "Tables in database: $TABLES"

if [ "$TABLES" -gt 0 ]; then
    log_info "✓ Restore verification passed"
else
    log_error "✗ Restore verification failed (no tables found)"
    exit 1
fi

log_info "Restore complete. Please verify application functionality."

exit 0
