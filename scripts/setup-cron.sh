#!/bin/bash
#
# Setup Cron Jobs for MDCLodging
# Installs automated backup and maintenance jobs
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/opt/mdclodging}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_DIR="${LOG_DIR:-/var/log/mdclodging}"

log_info "Setting up cron jobs for MDCLodging..."
log_info "Project directory: $PROJECT_DIR"
log_info "Backup directory: $BACKUP_DIR"
log_info "Log directory: $LOG_DIR"

# Create log directory
sudo mkdir -p "$LOG_DIR"
sudo chown -R "$USER:$USER" "$LOG_DIR"

# Make scripts executable
chmod +x "$PROJECT_DIR/scripts/backup-db.sh"
chmod +x "$PROJECT_DIR/scripts/restore-db.sh"

# Create cron jobs
CRON_FILE="/tmp/mdclodging-cron"

cat > "$CRON_FILE" << EOF
# MDCLodging Automated Jobs
# Generated: $(date)

# Database Backup - Daily at 3:00 AM
0 3 * * * cd $PROJECT_DIR && ./scripts/backup-db.sh >> $LOG_DIR/backup.log 2>&1

# Database Backup - Weekly full backup (Sunday 2:00 AM)
0 2 * * 0 cd $PROJECT_DIR && RETENTION_DAYS=90 ./scripts/backup-db.sh >> $LOG_DIR/backup-weekly.log 2>&1

# Clean old logs - Weekly (Sunday 4:00 AM)
0 4 * * 0 find $LOG_DIR -name "*.log" -mtime +30 -delete

# Docker cleanup - Monthly (1st of month at 5:00 AM)
0 5 1 * * docker system prune -af --volumes --filter "until=720h" >> $LOG_DIR/docker-cleanup.log 2>&1

# Metrics update (if not using server auto-update)
# */5 * * * * cd $PROJECT_DIR/packages/backend && node src/jobs/updateMetrics.js >> $LOG_DIR/metrics.log 2>&1

# Health check monitoring - Every 5 minutes
*/5 * * * * curl -f http://localhost:3000/health || echo "Health check failed at \$(date)" >> $LOG_DIR/health-check-failures.log

EOF

# Install cron jobs
crontab -l > /tmp/current-cron 2>/dev/null || true

if grep -q "MDCLodging Automated Jobs" /tmp/current-cron; then
    log_warn "MDCLodging cron jobs already installed"
    log_info "Updating existing cron jobs..."

    # Remove old MDCLodging jobs
    sed -i '/# MDCLodging Automated Jobs/,/^$/d' /tmp/current-cron

    # Append new jobs
    cat /tmp/current-cron "$CRON_FILE" | crontab -
else
    log_info "Installing new cron jobs..."
    cat /tmp/current-cron "$CRON_FILE" | crontab -
fi

# Cleanup
rm -f "$CRON_FILE" /tmp/current-cron

log_info "Cron jobs installed successfully!"
echo ""
log_info "Installed jobs:"
crontab -l | grep -A 20 "MDCLodging Automated Jobs"
echo ""
log_info "Logs location: $LOG_DIR"
log_info "Check logs with: tail -f $LOG_DIR/backup.log"

exit 0
