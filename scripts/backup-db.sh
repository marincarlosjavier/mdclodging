#!/bin/bash
#
# Database Backup Script for MDCLodging
# Creates compressed PostgreSQL backups with retention policy
#

set -e  # Exit on error

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_CONTAINER="${DB_CONTAINER:-mdclodging_postgres}"
DB_NAME="${DB_NAME:-mdclodging}"
DB_USER="${DB_USER:-postgres}"
RETENTION_DAYS=${RETENTION_DAYS:-30}
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
BACKUP_FILE="db_${TIMESTAMP}.dump"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log_info "Starting database backup at $TIMESTAMP..."
log_info "Database: $DB_NAME"
log_info "Container: $DB_CONTAINER"
log_info "Backup location: $BACKUP_DIR"

# Check if Docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    log_error "Docker container '$DB_CONTAINER' is not running"
    exit 1
fi

# Create backup using pg_dump
log_info "Creating backup..."
if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"; then
    log_info "Backup created: $BACKUP_FILE"
else
    log_error "Backup failed"
    exit 1
fi

# Get file size
FILESIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
log_info "Backup size: $FILESIZE"

# Compress backup
log_info "Compressing backup..."
if gzip "$BACKUP_DIR/$BACKUP_FILE"; then
    log_info "Backup compressed: ${BACKUP_FILE}.gz"
    COMPRESSED_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_FILE}.gz" | cut -f1)
    log_info "Compressed size: $COMPRESSED_SIZE"
else
    log_warn "Compression failed, continuing with uncompressed backup"
fi

# Upload to S3 if configured
if [ -n "$S3_BACKUP_BUCKET" ]; then
    log_info "Uploading to S3 bucket: $S3_BACKUP_BUCKET"

    if command -v aws &> /dev/null; then
        COMPRESSED_FILE="${BACKUP_FILE}.gz"
        if [ ! -f "$BACKUP_DIR/$COMPRESSED_FILE" ]; then
            COMPRESSED_FILE="$BACKUP_FILE"
        fi

        if aws s3 cp "$BACKUP_DIR/$COMPRESSED_FILE" "s3://$S3_BACKUP_BUCKET/backups/$COMPRESSED_FILE"; then
            log_info "Backup uploaded to S3"
        else
            log_warn "S3 upload failed, backup kept locally"
        fi
    else
        log_warn "AWS CLI not installed, skipping S3 upload"
    fi
fi

# Clean up old backups (retention policy)
log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
DELETED_COUNT=0

while IFS= read -r old_backup; do
    rm -f "$old_backup"
    ((DELETED_COUNT++))
done < <(find "$BACKUP_DIR" -name "db_*.dump*" -mtime +"$RETENTION_DAYS")

if [ "$DELETED_COUNT" -gt 0 ]; then
    log_info "Deleted $DELETED_COUNT old backup(s)"
else
    log_info "No old backups to delete"
fi

# Create backup metadata
METADATA_FILE="$BACKUP_DIR/${BACKUP_FILE}.meta"
cat > "$METADATA_FILE" << EOF
backup_timestamp=$TIMESTAMP
db_name=$DB_NAME
db_container=$DB_CONTAINER
original_size=$FILESIZE
compressed_size=$COMPRESSED_SIZE
backup_type=full
EOF

# Summary
log_info "========================================="
log_info "Backup completed successfully!"
log_info "Backup file: ${BACKUP_FILE}.gz"
log_info "Location: $BACKUP_DIR"
log_info "Original size: $FILESIZE"
log_info "Compressed size: $COMPRESSED_SIZE"
if [ -n "$S3_BACKUP_BUCKET" ]; then
    log_info "S3 location: s3://$S3_BACKUP_BUCKET/backups/${BACKUP_FILE}.gz"
fi
log_info "========================================="

# List recent backups
log_info "Recent backups:"
ls -lht "$BACKUP_DIR"/db_*.dump* | head -5

exit 0
