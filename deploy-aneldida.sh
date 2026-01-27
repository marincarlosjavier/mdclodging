#!/bin/bash
# Aneldida.com Deployment Script
# Run as deploy user on server

set -e

echo "🚀 Deploying Aneldida.com..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
REPO_URL="https://github.com/marincarlosjavier/mdclodging.git"
PROJECT_DIR="/opt/mdclodging"
DOMAIN="aneldida.com"

# JWT Secret and DB Password (will be provided)
JWT_SECRET="${JWT_SECRET:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$JWT_SECRET" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  Please run with secrets:${NC}"
    echo "JWT_SECRET='your-jwt-secret' DB_PASSWORD='your-db-password' bash deploy-aneldida.sh"
    exit 1
fi

# Step 1: Clone repository
echo -e "${BLUE}[1/10] Cloning repository...${NC}"
cd $PROJECT_DIR
if [ ! -d ".git" ]; then
    git clone $REPO_URL .
else
    git pull origin master
fi

# Step 2: Install dependencies
echo -e "${BLUE}[2/10] Installing dependencies...${NC}"
cd $PROJECT_DIR
pnpm install --frozen-lockfile

# Step 3: Create .env file
echo -e "${BLUE}[3/10] Creating .env file...${NC}"
cd $PROJECT_DIR/packages/backend
cat > .env << EOF
# Environment
NODE_ENV=production
PORT=3000

# Database (PostgreSQL in Docker)
DATABASE_URL=postgresql://mdclodging:${DB_PASSWORD}@postgres:5432/mdclodging
DB_HOST=postgres
DB_PORT=5432
DB_NAME=mdclodging
DB_USER=mdclodging
DB_PASSWORD=${DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}

# CORS
CORS_ORIGIN=https://app.${DOMAIN}
APP_URL=https://app.${DOMAIN}

# Telegram (configure later)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_ENABLED=false

# Stripe (configure later)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (configure later)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@${DOMAIN}

# Monitoring
SENTRY_DSN=
LOG_LEVEL=info
EOF

# Step 4: Update docker-compose with environment
echo -e "${BLUE}[4/10] Configuring Docker Compose...${NC}"
cd $PROJECT_DIR
cat > .env << EOF
DB_NAME=mdclodging
DB_USER=mdclodging
DB_PASSWORD=${DB_PASSWORD}
TAG=latest
GITHUB_REPOSITORY=marincarlosjavier/mdclodging
EOF

# Step 5: Build frontend
echo -e "${BLUE}[5/10] Building frontend...${NC}"
cd $PROJECT_DIR/packages/frontend
cat > .env << EOF
VITE_API_URL=https://api.${DOMAIN}
EOF
npm run build

# Step 6: Run database migrations
echo -e "${BLUE}[6/10] Running database migrations...${NC}"
cd $PROJECT_DIR

# Start only postgres first
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for postgres
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Run migrations via Docker
docker compose -f docker-compose.prod.yml run --rm backend node src/database/migrate.js || {
    echo -e "${YELLOW}Migration failed, trying alternative method...${NC}"
    cd $PROJECT_DIR/packages/backend
    pnpm install
    node src/database/migrate.js
}

# Step 7: Generate SSL certificates
echo -e "${BLUE}[7/10] Generating SSL certificates...${NC}"
sudo certbot certonly --standalone \
  -d app.${DOMAIN} \
  -d api.${DOMAIN} \
  --non-interactive \
  --agree-tos \
  --email admin@${DOMAIN} \
  --preferred-challenges http || echo "SSL generation failed, will use HTTP for now"

# Copy certificates if they exist
if [ -d "/etc/letsencrypt/live/app.${DOMAIN}" ]; then
    sudo mkdir -p $PROJECT_DIR/nginx/ssl
    sudo cp /etc/letsencrypt/live/app.${DOMAIN}/fullchain.pem $PROJECT_DIR/nginx/ssl/
    sudo cp /etc/letsencrypt/live/app.${DOMAIN}/privkey.pem $PROJECT_DIR/nginx/ssl/
    sudo chown -R deploy:deploy $PROJECT_DIR/nginx/ssl
fi

# Step 8: Create Nginx configuration
echo -e "${BLUE}[8/10] Creating Nginx configuration...${NC}"
mkdir -p $PROJECT_DIR/nginx

cat > $PROJECT_DIR/nginx/nginx.conf << 'NGINXEOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

    upstream backend {
        server backend:3000;
    }

    upstream frontend {
        server frontend:80;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name app.aneldida.com api.aneldida.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Frontend - app.aneldida.com
    server {
        listen 443 ssl http2;
        server_name app.aneldida.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # SSL config
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # API - api.aneldida.com
    server {
        listen 443 ssl http2;
        server_name api.aneldida.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        add_header Strict-Transport-Security "max-age=31536000" always;

        location / {
            limit_req zone=api_limit burst=20 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /auth/login {
            limit_req zone=login_limit burst=3 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /health {
            proxy_pass http://backend;
            access_log off;
        }
    }
}
NGINXEOF

# Step 9: Start all services
echo -e "${BLUE}[9/10] Starting all services...${NC}"
cd $PROJECT_DIR
docker compose -f docker-compose.prod.yml up -d

# Step 10: Setup automated backups
echo -e "${BLUE}[10/10] Setting up automated backups...${NC}"
chmod +x $PROJECT_DIR/scripts/*.sh
$PROJECT_DIR/scripts/setup-cron.sh

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your application should be accessible at:"
echo "  - Frontend: https://app.${DOMAIN}"
echo "  - API: https://api.${DOMAIN}"
echo ""
echo "Check status:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo ""
echo "View logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
