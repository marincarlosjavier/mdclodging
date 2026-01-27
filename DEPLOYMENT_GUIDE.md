# 🚀 MDCLodging Deployment Guide

## Pre-Deployment Setup (Stripe-Free)

This guide covers all deployment steps **except Stripe configuration**, which can be added later.

---

## Step 1: Generate SSH Keys for Deployment

### On Your Local Machine

```bash
# Generate deployment key
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/mdclodging_deploy

# You'll have two files:
# ~/.ssh/mdclodging_deploy (private key - for GitHub Secrets)
# ~/.ssh/mdclodging_deploy.pub (public key - for servers)
```

### View Keys

```bash
# Private key (for GitHub Secrets)
cat ~/.ssh/mdclodging_deploy

# Public key (for servers)
cat ~/.ssh/mdclodging_deploy.pub
```

---

## Step 2: GitHub Repository Setup

### 2.1 Initialize Git (if not already done)

```bash
cd C:\MDCLodging

# Initialize repository
git init
git add .
git commit -m "Initial commit - Production ready SaaS platform"

# Create GitHub repository (via GitHub web interface)
# Then connect:
git remote add origin https://github.com/yourusername/mdclodging.git
git branch -M main
git push -u origin main

# Create develop branch
git checkout -b develop
git push -u origin develop
```

### 2.2 Configure GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Click **"New repository secret"** for each:

#### For Staging (if you have staging server)
```
Name: STAGING_HOST
Value: staging.yourdomain.com (or IP address)

Name: STAGING_USER
Value: deploy

Name: STAGING_SSH_KEY
Value: <paste entire content of ~/.ssh/mdclodging_deploy>
```

#### For Production
```
Name: PROD_HOST
Value: app.mdclodging.com (or your production IP)

Name: PROD_USER
Value: deploy

Name: PROD_SSH_KEY
Value: <paste entire content of ~/.ssh/mdclodging_deploy>
```

---

## Step 3: Server Provisioning

### 3.1 Choose Hosting Provider

**Recommended: DigitalOcean**
- Cost: $56-76/month
- 4GB RAM Droplet: $24/month
- Managed PostgreSQL 1GB: $15/month
- Simple setup

**Alternative: AWS EC2**
- More expensive but more scalable
- São Paulo region for Colombia
- ~$150-200/month

**Alternative: Railway/Render (PaaS)**
- Easiest setup
- $20-50/month
- Less control

### 3.2 Create Server (DigitalOcean Example)

1. **Create Droplet:**
   - Go to: https://cloud.digitalocean.com/droplets/new
   - Choose: Ubuntu 22.04 LTS
   - Plan: Basic - 4GB RAM / 2 vCPUs ($24/month)
   - Region: New York 3 or Toronto (closest to Colombia)
   - Authentication: SSH keys (add your public key)
   - Hostname: mdclodging-prod
   - Click "Create Droplet"

2. **Create Managed Database:**
   - Go to: Databases → Create
   - Choose: PostgreSQL 16
   - Plan: Basic - 1GB RAM ($15/month)
   - Same region as droplet
   - Create

3. **Get Server IP:**
   - Note the droplet IP address (e.g., 147.182.xxx.xxx)

---

## Step 4: Server Initial Setup

### 4.1 Connect to Server

```bash
# From your local machine
ssh root@YOUR_SERVER_IP
```

### 4.2 Create Deploy User

```bash
# On the server
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Switch to deploy user
su - deploy
```

### 4.3 Add SSH Key

```bash
# On the server (as deploy user)
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Paste your PUBLIC key
nano ~/.ssh/authorized_keys
# Paste content of ~/.ssh/mdclodging_deploy.pub
# Save: Ctrl+O, Enter, Ctrl+X

chmod 600 ~/.ssh/authorized_keys
```

### 4.4 Test SSH Connection

```bash
# From your local machine
ssh -i ~/.ssh/mdclodging_deploy deploy@YOUR_SERVER_IP
# Should connect without password
```

---

## Step 5: Server Software Installation

### 5.1 Install Docker

```bash
# On the server (as deploy user)
curl -fsSL https://get.docker.com | sudo sh

# Add user to docker group
sudo usermod -aG docker deploy

# Log out and back in for group to take effect
exit
ssh -i ~/.ssh/mdclodging_deploy deploy@YOUR_SERVER_IP

# Verify
docker --version
```

### 5.2 Install Docker Compose

```bash
# On the server
sudo apt update
sudo apt install docker-compose-plugin -y

# Verify
docker compose version
```

### 5.3 Install pnpm (for builds)

```bash
# On the server
curl -fsSL https://get.pnpm.io/install.sh | sh

# Reload shell
source ~/.bashrc

# Verify
pnpm --version
```

### 5.4 Install Node.js

```bash
# On the server
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should be v18.x
npm --version
```

---

## Step 6: Project Setup on Server

### 6.1 Create Directories

```bash
# On the server
sudo mkdir -p /opt/mdclodging
sudo mkdir -p /backups
sudo chown -R deploy:deploy /opt/mdclodging /backups
```

### 6.2 Clone Repository

```bash
# On the server
cd /opt/mdclodging

# Clone (you may need to setup SSH key for GitHub on server)
git clone https://github.com/yourusername/mdclodging.git .

# Or use HTTPS with personal access token
git clone https://YOUR_TOKEN@github.com/yourusername/mdclodging.git .
```

### 6.3 Configure Environment Variables

```bash
# On the server
cd /opt/mdclodging/packages/backend
cp .env.example .env
nano .env
```

**Edit the following values:**

```env
# CRITICAL: Change these!
JWT_SECRET=<generate-64-character-random-string>
DB_PASSWORD=<strong-password-here>

# Database (use DigitalOcean managed DB connection string)
DATABASE_URL=postgresql://doadmin:PASSWORD@HOST:PORT/mdclodging?sslmode=require
DB_HOST=<from-digitalocean-db>
DB_PORT=25060
DB_NAME=mdclodging
DB_USER=doadmin
DB_PASSWORD=<from-digitalocean-db>

# Application
NODE_ENV=production
PORT=3000
APP_URL=https://app.mdclodging.com
CORS_ORIGIN=https://app.mdclodging.com

# Stripe (leave empty for now, will configure later)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Email (optional for now)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Sentry (optional)
SENTRY_DSN=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_ENABLED=false
```

**Generate JWT Secret:**
```bash
# On your local machine or server
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output to JWT_SECRET
```

**Save file:** Ctrl+O, Enter, Ctrl+X

---

## Step 7: Initial Database Setup

### 7.1 Run Migrations

```bash
# On the server
cd /opt/mdclodging/packages/backend

# Install dependencies
pnpm install --frozen-lockfile

# Run migrations
node src/database/migrate.js
```

You should see:
```
✅ Database connected
✅ All migrations completed successfully!
```

### 7.2 Create First Tenant (Platform Admin)

```bash
# On the server
cd /opt/mdclodging/packages/backend

# Connect to database
psql "$DATABASE_URL"

# Create platform tenant and admin user
```

```sql
-- Create platform tenant
INSERT INTO tenants (name, subdomain, is_active)
VALUES ('Platform Admin', 'platform', true)
RETURNING id;

-- Note the ID (should be 1)

-- Create platform admin user
-- Replace 'your-email@example.com' and hash a password
-- To hash a password:
-- node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 10))"

INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_active)
VALUES (
  1,
  'admin@mdclodging.com',
  '<bcrypt-hash-of-password>',
  'Platform Administrator',
  ARRAY['platform_admin', 'admin'],
  true
);

-- Exit psql
\q
```

---

## Step 8: DNS Configuration

### 8.1 Configure DNS Records

Go to your domain registrar (Namecheap, GoDaddy, CloudFlare, etc.)

**Add these A records:**

```
Type  Name              Value (Points to)
A     app               YOUR_SERVER_IP
A     api               YOUR_SERVER_IP
A     staging           YOUR_STAGING_IP (if using staging)
A     api-staging       YOUR_STAGING_IP (if using staging)
A     @                 YOUR_SERVER_IP (optional, for root domain)
```

**Example with DigitalOcean:**
- `app.mdclodging.com` → `147.182.xxx.xxx`
- `api.mdclodging.com` → `147.182.xxx.xxx`

### 8.2 Verify DNS Propagation

```bash
# On your local machine
nslookup app.mdclodging.com
# Should return your server IP

# Or use online tools:
# https://dnschecker.org/
```

**Note:** DNS can take 5 minutes to 48 hours to propagate worldwide

---

## Step 9: SSL Certificates (Let's Encrypt)

### 9.1 Install Certbot

```bash
# On the server
sudo apt install certbot python3-certbot-nginx -y
```

### 9.2 Generate Certificates

**Option 1: Standalone (if nginx not running yet)**

```bash
# On the server
sudo certbot certonly --standalone \
  -d app.mdclodging.com \
  -d api.mdclodging.com \
  --email admin@mdclodging.com \
  --agree-tos \
  --non-interactive

# Certificates will be in:
# /etc/letsencrypt/live/app.mdclodging.com/
```

**Option 2: Webroot (if nginx already running)**

```bash
# Create webroot directory
sudo mkdir -p /var/www/certbot

# Generate
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d app.mdclodging.com \
  -d api.mdclodging.com \
  --email admin@mdclodging.com \
  --agree-tos \
  --non-interactive
```

### 9.3 Copy Certificates for Docker

```bash
# On the server
cd /opt/mdclodging
mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/app.mdclodging.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/app.mdclodging.com/privkey.pem nginx/ssl/

# Set permissions
sudo chown -R deploy:deploy nginx/ssl
chmod 644 nginx/ssl/*.pem
```

### 9.4 Setup Auto-Renewal

```bash
# On the server
# Certbot auto-renewal is included in docker-compose.prod.yml
# It will run every 12 hours automatically
```

---

## Step 10: Nginx Configuration

### 10.1 Create Production Nginx Config

```bash
# On the server
cd /opt/mdclodging
mkdir -p nginx
nano nginx/nginx.prod.conf
```

**Paste this configuration:**

```nginx
events {
    worker_connections 1024;
}

http {
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
        server_name _;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS - Application
    server {
        listen 443 ssl http2;
        server_name app.mdclodging.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # HTTPS - API
    server {
        listen 443 ssl http2;
        server_name api.mdclodging.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;

        location / {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/auth/login {
            limit_req zone=login_limit burst=3 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /health {
            proxy_pass http://backend;
            access_log off;
        }

        location /metrics {
            proxy_pass http://backend;
            # Optional: restrict metrics endpoint
            # allow 10.0.0.0/8;  # Internal network
            # deny all;
        }
    }
}
```

**Save:** Ctrl+O, Enter, Ctrl+X

---

## Step 11: Build and Deploy

### 11.1 Install Dependencies

```bash
# On the server
cd /opt/mdclodging

pnpm install --frozen-lockfile
```

### 11.2 Build Frontend

```bash
# On the server
cd /opt/mdclodging/packages/frontend

# Create production .env
cat > .env << EOF
VITE_API_URL=https://api.mdclodging.com
EOF

# Build
npm run build
```

### 11.3 Start Production Containers

```bash
# On the server
cd /opt/mdclodging

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 11.4 Verify Deployment

```bash
# Check containers are running
docker ps

# Should see:
# - mdclodging_postgres
# - mdclodging_backend
# - mdclodging_frontend
# - mdclodging_nginx
# - mdclodging_certbot

# Test health endpoint
curl http://localhost:3000/health
# Should return: {"status":"ok",...}

# Test external access
curl https://api.mdclodging.com/health
# Should return: {"status":"ok",...}
```

---

## Step 12: Setup Monitoring

### 12.1 Start Monitoring Stack

```bash
# On the server
cd /opt/mdclodging

# Create .env for monitoring
cat > .env.monitoring << EOF
GRAFANA_PASSWORD=<strong-password-here>
DB_USER=doadmin
DB_PASSWORD=<your-db-password>
DB_NAME=mdclodging
EOF

# Start monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

### 12.2 Access Grafana

1. Open: `http://YOUR_SERVER_IP:3002`
2. Login: admin / (password from .env.monitoring)
3. Change password on first login
4. Add Prometheus datasource:
   - URL: `http://prometheus:9090`
   - Save & Test

### 12.3 Access Prometheus

1. Open: `http://YOUR_SERVER_IP:9090`
2. Check targets: Status → Targets
3. All should be "UP"

---

## Step 13: Setup Automated Backups

### 13.1 Make Scripts Executable

```bash
# On the server
cd /opt/mdclodging
chmod +x scripts/*.sh
```

### 13.2 Install Cron Jobs

```bash
# On the server
./scripts/setup-cron.sh
```

This installs:
- Daily database backup at 3 AM
- Weekly full backup on Sunday 2 AM
- Log cleanup
- Health monitoring

### 13.3 Test Backup

```bash
# On the server
./scripts/backup-db.sh

# Check backup was created
ls -lh /backups/
```

---

## Step 14: GitHub Actions Setup

### 14.1 Update docker-compose.prod.yml

```bash
# On the server
cd /opt/mdclodging
nano docker-compose.prod.yml
```

**Change:**
```yaml
# FROM:
backend:
  build:
    context: ./packages/backend

# TO:
backend:
  image: ghcr.io/yourusername/mdclodging-backend:latest
```

**Same for frontend:**
```yaml
# FROM:
frontend:
  build:
    context: ./packages/frontend

# TO:
frontend:
  image: ghcr.io/yourusername/mdclodging-frontend:latest
```

### 14.2 Enable GitHub Container Registry

1. Go to: **GitHub Profile → Settings → Developer settings → Personal access tokens**
2. Generate new token (classic)
3. Permissions: `write:packages`, `read:packages`
4. Copy token

### 14.3 Login to GitHub Container Registry

```bash
# On the server
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

---

## Step 15: First Deployment Test

### 15.1 Tag and Push

```bash
# On your local machine
cd C:\MDCLodging

# Commit any remaining changes
git add .
git commit -m "Production configuration complete"
git push origin main

# Create first version tag
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

### 15.2 Monitor GitHub Actions

1. Go to: **GitHub Repository → Actions**
2. Watch workflows run:
   - CI Pipeline
   - Build and Publish Docker Images
   - Deploy to Production (requires approval)

3. When "Deploy to Production" asks for approval:
   - Click "Review deployments"
   - Check "production"
   - Click "Approve and deploy"

### 15.3 Verify Deployment

```bash
# Check application
curl https://api.mdclodging.com/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}

# Check frontend
curl https://app.mdclodging.com

# Should return HTML
```

---

## Step 16: Post-Deployment Verification

### 16.1 Test Complete Flow

1. **Open Browser:**
   ```
   https://app.mdclodging.com
   ```

2. **Test Registration:**
   - Create test tenant
   - Verify email (if SMTP configured)
   - Login

3. **Test API:**
   ```bash
   # Login
   curl -X POST https://api.mdclodging.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@mdclodging.com",
       "password": "your-password",
       "subdomain": "platform"
     }'
   ```

4. **Check Metrics:**
   ```
   https://api.mdclodging.com/metrics
   ```

5. **Check Health:**
   ```
   https://api.mdclodging.com/health
   ```

### 16.2 Monitor Logs

```bash
# On the server
# Backend logs
docker logs mdclodging_backend -f

# Frontend logs
docker logs mdclodging_frontend -f

# Nginx logs
docker logs mdclodging_nginx -f

# All logs
docker compose -f docker-compose.prod.yml logs -f
```

---

## Step 17: Security Hardening

### 17.1 Configure Firewall

```bash
# On the server
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# Verify
sudo ufw status
```

### 17.2 Disable Root SSH

```bash
# On the server
sudo nano /etc/ssh/sshd_config

# Change:
PermitRootLogin no

# Save and restart SSH
sudo systemctl restart sshd
```

### 17.3 Setup Fail2Ban (Optional but Recommended)

```bash
# On the server
sudo apt install fail2ban -y

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Enable SSH protection
# Find [sshd] section, set:
# enabled = true
# maxretry = 3

# Start service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Step 18: Monitoring Setup

### 18.1 Create Grafana Dashboards

Import these dashboard IDs in Grafana:
- Node Exporter Full: `1860`
- PostgreSQL Database: `9628`
- Docker Container & Host Metrics: `10619`

### 18.2 Setup Alerts

In Grafana:
1. **Alerting → Notification channels**
2. Add Email/Slack/Discord
3. Test notification
4. Alerts auto-configured from Prometheus rules

---

## Troubleshooting

### Issue: Cannot connect to server
```bash
# Check if server is running
ping YOUR_SERVER_IP

# Check SSH
ssh -vvv deploy@YOUR_SERVER_IP

# Check firewall
sudo ufw status
```

### Issue: DNS not resolving
```bash
# Check DNS propagation
nslookup app.mdclodging.com

# Try with Google DNS
nslookup app.mdclodging.com 8.8.8.8

# Wait up to 48 hours for full propagation
```

### Issue: SSL certificate error
```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --dry-run

# Check nginx config
docker exec mdclodging_nginx nginx -t
```

### Issue: Docker containers not starting
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Check specific container
docker logs mdclodging_backend

# Restart containers
docker compose -f docker-compose.prod.yml restart
```

### Issue: Database connection error
```bash
# Check database is running
docker ps | grep postgres

# Test connection from backend
docker exec mdclodging_backend node -e "require('./src/config/database.js').pool.query('SELECT NOW()')"

# Check environment variables
docker exec mdclodging_backend env | grep DATABASE_URL
```

---

## Next Steps

✅ **Completed:**
- Server provisioned
- Software installed
- Repository deployed
- Database migrated
- SSL configured
- Monitoring setup
- Backups automated
- CI/CD configured

⏭️ **When Ready:**
- Configure Stripe (separate guide)
- Set up custom domain email
- Add more monitoring dashboards
- Configure advanced alerts
- Set up staging environment

---

## Useful Commands

```bash
# View all running containers
docker ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop all services
docker compose -f docker-compose.prod.yml down

# Start all services
docker compose -f docker-compose.prod.yml up -d

# View backups
ls -lh /backups/

# Run backup manually
./scripts/backup-db.sh

# Check cron jobs
crontab -l

# View system resources
htop

# Check disk space
df -h

# Check memory
free -h
```

---

## Support

**Documentation:**
- Main: `PRODUCTION_READY.md`
- Phases: `PHASE1_COMPLETE.md`, `PHASE2_COMPLETE.md`, `PHASE3_COMPLETE.md`
- CI/CD: `.github/workflows/README.md`

**Logs Location:**
- Application: `/opt/mdclodging/logs/`
- Backups: `/var/log/mdclodging/backup.log`
- System: `/var/log/syslog`

**Monitoring:**
- Grafana: `http://YOUR_SERVER_IP:3002`
- Prometheus: `http://YOUR_SERVER_IP:9090`
- Metrics: `https://api.mdclodging.com/metrics`

---

**Status:** Ready for production! 🚀
**Stripe Setup:** Configure when ready to accept payments
