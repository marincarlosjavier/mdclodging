# ✅ MDCLodging Deployment Checklist

Quick reference for deploying to production (Stripe setup excluded).

---

## Pre-Deployment (Local Machine)

### ☐ 1. Generate SSH Keys
```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/mdclodging_deploy
cat ~/.ssh/mdclodging_deploy      # Copy private key
cat ~/.ssh/mdclodging_deploy.pub  # Copy public key
```

### ☐ 2. Setup GitHub Repository
```bash
cd C:\MDCLodging
git init
git add .
git commit -m "Production ready"
git remote add origin https://github.com/YOUR_USERNAME/mdclodging.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```

### ☐ 3. Configure GitHub Secrets
Go to: **Repo → Settings → Secrets → Actions**

Add secrets:
- `PROD_HOST` = Your server IP or domain
- `PROD_USER` = deploy
- `PROD_SSH_KEY` = Private key content

---

## Server Setup

### ☐ 4. Provision Server
- [ ] Create Ubuntu 22.04 server (4GB RAM minimum)
- [ ] Create PostgreSQL database (managed or Docker)
- [ ] Note server IP address

### ☐ 5. Initial Server Configuration
```bash
# Connect as root
ssh root@YOUR_SERVER_IP

# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Switch to deploy user
su - deploy

# Add SSH public key
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Paste public key, save

chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# Test connection
exit
ssh -i ~/.ssh/mdclodging_deploy deploy@YOUR_SERVER_IP
```

### ☐ 6. Install Software
```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy

# Log out and back in
exit
ssh -i ~/.ssh/mdclodging_deploy deploy@YOUR_SERVER_IP

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh
source ~/.bashrc

# Verify
docker --version
node --version
pnpm --version
```

---

## Project Setup

### ☐ 7. Create Directories
```bash
sudo mkdir -p /opt/mdclodging /backups
sudo chown -R deploy:deploy /opt/mdclodging /backups
```

### ☐ 8. Clone Repository
```bash
cd /opt/mdclodging
git clone https://github.com/YOUR_USERNAME/mdclodging.git .
```

### ☐ 9. Configure Environment
```bash
cd /opt/mdclodging/packages/backend
cp .env.example .env
nano .env
```

**Critical values to change:**
```env
JWT_SECRET=<64-char-random-string>
DATABASE_URL=postgresql://user:pass@host:port/db
DB_PASSWORD=<strong-password>
APP_URL=https://app.mdclodging.com
CORS_ORIGIN=https://app.mdclodging.com
NODE_ENV=production

# Leave empty for now
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Generate JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### ☐ 10. Run Database Migrations
```bash
cd /opt/mdclodging/packages/backend
pnpm install --frozen-lockfile
node src/database/migrate.js
```

Should see: `✅ All migrations completed successfully!`

---

## DNS & SSL

### ☐ 11. Configure DNS
In your domain registrar, add A records:
- `app.yourdomain.com` → `YOUR_SERVER_IP`
- `api.yourdomain.com` → `YOUR_SERVER_IP`

Verify:
```bash
nslookup app.yourdomain.com
```

### ☐ 12. Generate SSL Certificates
```bash
# Install certbot
sudo apt install certbot -y

# Generate certificates
sudo certbot certonly --standalone \
  -d app.yourdomain.com \
  -d api.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive

# Copy to project
cd /opt/mdclodging
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/app.yourdomain.com/privkey.pem nginx/ssl/
sudo chown -R deploy:deploy nginx/ssl
```

---

## Nginx Configuration

### ☐ 13. Create Nginx Config
```bash
cd /opt/mdclodging
mkdir -p nginx
nano nginx/nginx.prod.conf
```

Use config from `DEPLOYMENT_GUIDE.md` Step 10.1

**Change these values:**
- `server_name` lines: Use your actual domain
- Certificate paths: Match your domain

---

## Build & Deploy

### ☐ 14. Build Frontend
```bash
cd /opt/mdclodging/packages/frontend

# Create production env
echo "VITE_API_URL=https://api.yourdomain.com" > .env

# Build
npm run build
```

### ☐ 15. Install Project Dependencies
```bash
cd /opt/mdclodging
pnpm install --frozen-lockfile
```

### ☐ 16. Start Production Services
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml up -d
```

### ☐ 17. Verify Deployment
```bash
# Check containers
docker ps

# Test locally
curl http://localhost:3000/health

# Test externally
curl https://api.yourdomain.com/health
```

Should return: `{"status":"ok",...}`

---

## Monitoring & Backups

### ☐ 18. Start Monitoring Stack
```bash
cd /opt/mdclodging

# Create monitoring env
cat > .env.monitoring << EOF
GRAFANA_PASSWORD=<strong-password>
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
DB_NAME=mdclodging
EOF

docker compose -f docker-compose.monitoring.yml up -d
```

Access:
- Grafana: `http://YOUR_SERVER_IP:3002`
- Prometheus: `http://YOUR_SERVER_IP:9090`

### ☐ 19. Setup Automated Backups
```bash
cd /opt/mdclodging
chmod +x scripts/*.sh
./scripts/setup-cron.sh
```

Test backup:
```bash
./scripts/backup-db.sh
ls -lh /backups/
```

---

## Security Hardening

### ☐ 20. Configure Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### ☐ 21. Disable Root SSH
```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

---

## CI/CD Setup

### ☐ 22. Update docker-compose.prod.yml
```bash
nano docker-compose.prod.yml
```

Change `build:` to `image:` for backend and frontend:
```yaml
backend:
  image: ghcr.io/YOUR_USERNAME/mdclodging-backend:latest

frontend:
  image: ghcr.io/YOUR_USERNAME/mdclodging-frontend:latest
```

### ☐ 23. Login to GitHub Container Registry
```bash
# Create GitHub personal access token with packages:write permission
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

---

## First Production Deployment

### ☐ 24. Deploy via GitHub Actions
```bash
# On your local machine
cd C:\MDCLodging

git add .
git commit -m "Production deployment configuration"
git push origin main

# Tag release
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

### ☐ 25. Monitor Deployment
1. Go to GitHub Actions
2. Watch workflows run
3. Approve production deployment when prompted
4. Verify success

### ☐ 26. Final Verification
```bash
# Test health
curl https://api.yourdomain.com/health

# Test metrics
curl https://api.yourdomain.com/metrics

# Open in browser
https://app.yourdomain.com
```

---

## Post-Deployment

### ☐ 27. Test Application
- [ ] Open `https://app.yourdomain.com`
- [ ] Create test tenant account
- [ ] Login successfully
- [ ] Test basic functionality
- [ ] Check browser console for errors

### ☐ 28. Monitor Logs
```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View specific service
docker logs mdclodging_backend -f
```

### ☐ 29. Check Monitoring
- [ ] Grafana dashboards loading
- [ ] Prometheus targets all UP
- [ ] Metrics endpoint responding
- [ ] No alerts firing

### ☐ 30. Verify Backups
```bash
# Check cron jobs installed
crontab -l

# Check backup logs
tail -f /var/log/mdclodging/backup.log

# Verify backup exists
ls -lh /backups/
```

---

## Troubleshooting

### Container won't start
```bash
docker compose -f docker-compose.prod.yml logs SERVICE_NAME
docker compose -f docker-compose.prod.yml restart SERVICE_NAME
```

### DNS not resolving
```bash
nslookup app.yourdomain.com 8.8.8.8
# Wait up to 48 hours for propagation
```

### SSL certificate error
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Can't connect to database
```bash
# Test connection
docker exec mdclodging_backend node -e "require('./src/config/database.js').pool.query('SELECT NOW()', (e,r) => console.log(e || r.rows[0]))"
```

### High memory usage
```bash
# Check resources
htop
docker stats

# Restart services
docker compose -f docker-compose.prod.yml restart
```

---

## Done! ✅

Your production deployment is complete (except Stripe).

**What's Working:**
- ✅ Application deployed and accessible
- ✅ SSL certificates installed
- ✅ Monitoring active
- ✅ Automated backups running
- ✅ CI/CD pipeline configured
- ✅ Security hardened

**Next Steps:**
- Configure Stripe when ready for payments
- Add custom domain email (optional)
- Import Grafana dashboards
- Test complete user flows
- Begin customer onboarding

---

## Quick Reference

**Server Access:**
```bash
ssh -i ~/.ssh/mdclodging_deploy deploy@YOUR_SERVER_IP
```

**View Logs:**
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml logs -f
```

**Restart Services:**
```bash
docker compose -f docker-compose.prod.yml restart
```

**Manual Backup:**
```bash
cd /opt/mdclodging
./scripts/backup-db.sh
```

**Deploy New Version:**
```bash
# Local machine
git tag -a v1.0.1 -m "Bug fixes"
git push origin v1.0.1
# GitHub Actions handles deployment
```

---

**Deployment Status:** 🟢 PRODUCTION READY
**Stripe Status:** ⏸️ Configure when ready
