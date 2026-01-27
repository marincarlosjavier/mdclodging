# GitHub Actions Workflows

This directory contains all CI/CD workflows for the MDCLodging project.

## Workflows

### 1. CI Pipeline (`ci.yml`)
**Trigger:** Every push and pull request

**Jobs:**
- **Lint:** ESLint checks on backend and frontend
- **Test Backend:** Unit tests with PostgreSQL service
- **Test Frontend:** Frontend unit tests
- **Build:** Build both backend and frontend
- **Security Audit:** npm/pnpm audit for vulnerabilities
- **Docker Build:** Build Docker images (main/develop only)

**Status:** Runs on all branches

### 2. Docker Publish (`docker-publish.yml`)
**Trigger:** Push to main/develop or version tags (v*)

**What it does:**
- Builds Docker images for backend and frontend
- Publishes to GitHub Container Registry (ghcr.io)
- Tags images with branch name, commit SHA, and version
- Multi-platform builds (amd64, arm64)

**Image Tags:**
- `latest` - Latest from default branch
- `develop` - Latest from develop branch
- `v1.0.0` - Semantic version tags
- `main-abc123` - Branch + commit SHA

### 3. Deploy Staging (`deploy-staging.yml`)
**Trigger:** Push to develop branch

**Environment:** Staging
**URL:** https://staging.mdclodging.com

**Steps:**
1. SSH to staging server
2. Pull latest develop code
3. Install dependencies
4. Build frontend
5. Run database migrations
6. Restart Docker containers
7. Health check (10 attempts, 30s interval)
8. Smoke tests
9. Rollback on failure

**Required Secrets:**
- `STAGING_HOST` - Staging server IP/hostname
- `STAGING_USER` - SSH username
- `STAGING_SSH_KEY` - Private SSH key

### 4. Deploy Production (`deploy-production.yml`)
**Trigger:** Version tag push (v*) or manual dispatch

**Environment:** Production
**URL:** https://app.mdclodging.com

**Steps:**
1. Verify version tag format (vX.Y.Z)
2. Create pre-deployment backup (DB + code)
3. SSH to production server
4. Checkout version tag
5. Install dependencies
6. Build frontend
7. Run database migrations
8. Update Docker containers (zero-downtime)
9. Health check (15 attempts, 15s interval)
10. Production smoke tests
11. Verify metrics endpoint
12. Rollback on failure (restore backup)

**Required Secrets:**
- `PROD_HOST` - Production server IP/hostname
- `PROD_USER` - SSH username
- `PROD_SSH_KEY` - Private SSH key

## Setup Instructions

### 1. Configure GitHub Secrets

Go to: `Settings → Secrets and variables → Actions`

**Add these secrets:**

```bash
# Staging Environment
STAGING_HOST=staging.example.com
STAGING_USER=deploy
STAGING_SSH_KEY=<private-key-content>

# Production Environment
PROD_HOST=app.mdclodging.com
PROD_USER=deploy
PROD_SSH_KEY=<private-key-content>
```

### 2. Generate SSH Keys

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions@mdclodging" -f ~/.ssh/mdclodging_deploy

# Copy public key to servers
ssh-copy-id -i ~/.ssh/mdclodging_deploy.pub deploy@staging.example.com
ssh-copy-id -i ~/.ssh/mdclodging_deploy.pub deploy@app.mdclodging.com

# Copy private key content to GitHub Secrets
cat ~/.ssh/mdclodging_deploy
```

### 3. Server Preparation

On both staging and production servers:

```bash
# Create deployment directory
sudo mkdir -p /opt/mdclodging
sudo mkdir -p /backups
sudo chown -R deploy:deploy /opt/mdclodging /backups

# Clone repository
cd /opt/mdclodging
git clone https://github.com/yourusername/mdclodging.git .

# Install dependencies
curl -fsSL https://get.docker.com | sh
curl -fsSL https://get.pnpm.io/install.sh | sh

# Setup environment
cp .env.example .env
nano .env  # Fill in production values

# Initial deployment
pnpm install --frozen-lockfile
cd packages/frontend && npm run build && cd ../..
cd packages/backend && node src/database/migrate.js && cd ../..
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Enable GitHub Container Registry

1. Go to: `Settings → Packages`
2. Make repository public or grant read access
3. Ensure `GITHUB_TOKEN` has `packages:write` permission (automatic in workflows)

## Deployment Process

### Staging Deployment (Automatic)

1. Merge PR to `develop` branch
2. GitHub Actions automatically deploys to staging
3. Monitor deployment in Actions tab
4. Test on https://staging.mdclodging.com

### Production Deployment (Manual)

1. **Create Version Tag:**
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. **Monitor Deployment:**
   - Go to Actions tab
   - Watch "Deploy to Production" workflow
   - Deployment requires manual approval in GitHub environments

3. **Manual Deployment (Alternative):**
   - Go to Actions → Deploy to Production
   - Click "Run workflow"
   - Enter version tag (e.g., v1.0.0)
   - Confirm

### Rollback

If production deployment fails:
1. Workflow automatically rolls back to previous version
2. Restores code and database from backup
3. Notifications sent to configured channels

**Manual Rollback:**
```bash
ssh deploy@app.mdclodging.com
cd /opt/mdclodging

# Restore from backup
LATEST_BACKUP=$(ls -t /backups/code_pre-deploy-*.tar.gz | head -1)
tar -xzf "$LATEST_BACKUP"
docker-compose -f docker-compose.prod.yml up -d --build
```

## Monitoring Deployments

### View Logs
```bash
# SSH to server
ssh deploy@app.mdclodging.com

# View Docker logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Check Health
```bash
# API health
curl https://api.mdclodging.com/health

# Metrics
curl https://api.mdclodging.com/metrics
```

## Workflow Status Badges

Add to your README.md:

```markdown
![CI](https://github.com/yourusername/mdclodging/workflows/CI%20Pipeline/badge.svg)
![Docker](https://github.com/yourusername/mdclodging/workflows/Build%20and%20Publish%20Docker%20Images/badge.svg)
![Staging](https://github.com/yourusername/mdclodging/workflows/Deploy%20to%20Staging/badge.svg)
![Production](https://github.com/yourusername/mdclodging/workflows/Deploy%20to%20Production/badge.svg)
```

## Troubleshooting

### SSH Connection Fails
- Verify SSH key is correct in GitHub Secrets
- Check server SSH configuration allows key auth
- Ensure `deploy` user has necessary permissions

### Docker Build Fails
- Check Dockerfile paths are correct
- Verify dependencies can be installed
- Check for syntax errors in Dockerfile

### Health Check Fails
- Increase retry attempts or wait time
- Check backend logs: `docker logs mdclodging_backend`
- Verify database connection
- Check environment variables are set

### Migration Fails
- Database may be in bad state
- Manually connect and check schema
- Restore from backup if needed

## Best Practices

1. **Always test on staging first**
2. **Use semantic versioning for releases** (vX.Y.Z)
3. **Monitor deployments in real-time**
4. **Keep backups for at least 30 days**
5. **Review health checks before marking deployment success**
6. **Document deployment issues in changelog**

## Future Improvements

- [ ] Add Slack/Discord notifications
- [ ] Implement blue-green deployments
- [ ] Add automated E2E tests
- [ ] Implement canary deployments
- [ ] Add performance benchmarks
- [ ] Database migration rollback support
- [ ] Automatic backup verification
