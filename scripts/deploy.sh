#!/bin/bash
# MDCLodging - Production Deploy Script
# Automatically pulls latest code and updates containers

set -e  # Exit on error

echo "=================================================="
echo "🚀 MDCLodging Production Deployment"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/mdclodging"
COMPOSE_FILE="docker-compose.prod.yml"

cd $PROJECT_DIR

echo -e "${YELLOW}📥 Pulling latest code from GitHub...${NC}"
git fetch origin
CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/master)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    echo -e "${GREEN}✅ Already up to date (commit: ${CURRENT_COMMIT:0:7})${NC}"
    exit 0
fi

echo -e "${YELLOW}🔄 Updating from ${CURRENT_COMMIT:0:7} to ${LATEST_COMMIT:0:7}${NC}"
git pull origin master

echo ""
echo -e "${YELLOW}🔍 Checking for changes...${NC}"

# Check if backend code changed
if git diff --name-only $CURRENT_COMMIT $LATEST_COMMIT | grep -q "^packages/backend/"; then
    echo -e "${GREEN}✓ Backend changes detected${NC}"
    REBUILD_BACKEND=true
else
    REBUILD_BACKEND=false
fi

# Check if frontend code changed
if git diff --name-only $CURRENT_COMMIT $LATEST_COMMIT | grep -q "^packages/frontend/"; then
    echo -e "${GREEN}✓ Frontend changes detected${NC}"
    REBUILD_FRONTEND=true
else
    REBUILD_FRONTEND=false
fi

# Check if migrations added
if git diff --name-only $CURRENT_COMMIT $LATEST_COMMIT | grep -q "packages/backend/src/database/migrations/"; then
    echo -e "${GREEN}✓ New migrations detected${NC}"
    RUN_MIGRATIONS=true
else
    RUN_MIGRATIONS=false
fi

echo ""

# Run migrations if needed
if [ "$RUN_MIGRATIONS" = true ]; then
    echo -e "${YELLOW}📊 Running database migrations...${NC}"
    NEW_MIGRATIONS=$(git diff --name-only $CURRENT_COMMIT $LATEST_COMMIT | grep "packages/backend/src/database/migrations/" | sort)
    for migration in $NEW_MIGRATIONS; do
        if [ -f "$migration" ]; then
            MIGRATION_FILE=$(basename "$migration")
            echo -e "  → Applying ${MIGRATION_FILE}..."
            docker exec -i mdclodging_postgres psql -U mdclodging -d mdclodging < "$migration" || true
        fi
    done
    echo -e "${GREEN}✅ Migrations completed${NC}"
fi

# Rebuild backend if needed
if [ "$REBUILD_BACKEND" = true ]; then
    echo -e "${YELLOW}🔨 Rebuilding backend...${NC}"
    docker rm -f mdclodging_backend 2>/dev/null || true

    # Rebuild using docker run with all env vars
    docker build -t mdclodging-backend:latest packages/backend

    docker run -d \
      --name mdclodging_backend \
      --restart always \
      --network mdclodging_mdclodging_network \
      -p 127.0.0.1:3000:3000 \
      -e NODE_ENV=production \
      -e PORT=3000 \
      -e DATABASE_URL='postgresql://mdclodging:OxrEpMSUUkThvbGyR2YXcAxx@postgres:5432/mdclodging?sslmode=disable' \
      -e DB_HOST=postgres \
      -e DB_PORT=5432 \
      -e DB_NAME=mdclodging \
      -e DB_USER=mdclodging \
      -e DB_PASSWORD=OxrEpMSUUkThvbGyR2YXcAxx \
      -e JWT_SECRET=e6327fc78c321fb1df5ac5e20385382d862c67735c9f0ce755dba5763f25f8e1 \
      -e CORS_ORIGIN=https://app.aneldida.com \
      -e APP_URL=https://app.aneldida.com \
      -e LOG_LEVEL=info \
      -v /opt/mdclodging/logs:/app/logs \
      mdclodging-backend:latest

    echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
    sleep 10
    echo -e "${GREEN}✅ Backend deployed${NC}"
fi

# Rebuild frontend if needed
if [ "$REBUILD_FRONTEND" = true ]; then
    echo -e "${YELLOW}🔨 Rebuilding frontend...${NC}"
    docker compose -f $COMPOSE_FILE up -d --build frontend
    sleep 5
    echo -e "${GREEN}✅ Frontend deployed${NC}"
fi

echo ""
echo -e "${YELLOW}🧪 Running health checks...${NC}"

# Check API health
if curl -f -s https://api.aneldida.com/health > /dev/null; then
    echo -e "${GREEN}✅ API is responding${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    docker logs mdclodging_backend --tail 30
    exit 1
fi

# Check frontend
if curl -f -s https://app.aneldida.com > /dev/null; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${RED}❌ Frontend check failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=================================================="
echo "✅ Deployment completed successfully!"
echo "=================================================="
echo ""
echo "📝 Deployed commit: ${LATEST_COMMIT:0:7}"
echo "🕐 Time: $(date)"
echo ""
