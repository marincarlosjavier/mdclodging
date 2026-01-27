# 🔐 GitHub Secrets Configuration Guide

Quick guide to configure GitHub secrets for automated CI/CD deployment.

## When to Do This

**After you have:**
- ✅ Created your production server
- ✅ Configured SSH access to server
- ✅ Noted your server IP address

**Before you:**
- Deploy via GitHub Actions
- Tag releases for production

---

## Required Secrets

Your CI/CD pipeline needs these secrets to deploy automatically:

### 1. PROD_HOST
**What:** Your production server IP address or domain
**Example:** `164.92.75.123` or `mdclodging.com`
**Where to get:** From your hosting provider (DigitalOcean, AWS, etc.)

### 2. PROD_USER
**What:** SSH username on production server
**Value:** `deploy` (as created in deployment guide)
**Default:** Always `deploy` if you followed DEPLOYMENT_GUIDE.md

### 3. PROD_SSH_KEY
**What:** Private SSH key for server access
**Where to get:** Your local machine

**On Windows:**
```powershell
# View your private key
type %USERPROFILE%\.ssh\mdclodging_deploy
```

**Copy the ENTIRE output**, including:
```
-----BEGIN OPENSSH PRIVATE KEY-----
... (many lines) ...
-----END OPENSSH PRIVATE KEY-----
```

---

## How to Add Secrets to GitHub

### Step 1: Go to Your Repository Settings
1. Open: https://github.com/marincarlosjavier/mdclodging
2. Click **Settings** tab (top right)
3. In left sidebar, click **Secrets and variables** → **Actions**

### Step 2: Add Each Secret
For each secret:

1. Click **New repository secret** (green button)
2. **Name:** Enter exact name (e.g., `PROD_HOST`)
3. **Secret:** Paste the value
4. Click **Add secret**

Repeat for all 3 required secrets.

### Step 3: Verify Secrets Added
You should see 3 secrets listed:
- ✅ PROD_HOST
- ✅ PROD_USER
- ✅ PROD_SSH_KEY

**Note:** You can't view secret values after adding (security feature)

---

## Optional Secrets

### For Notifications

#### SLACK_WEBHOOK
**What:** Webhook URL for deployment notifications to Slack
**When to add:** If you use Slack for team communication

**How to get:**
1. Go to Slack workspace
2. Add "Incoming Webhooks" app
3. Create webhook for your channel
4. Copy webhook URL (starts with `https://hooks.slack.com/...`)

#### DISCORD_WEBHOOK
**What:** Webhook URL for Discord notifications
**When to add:** If you use Discord

**How to get:**
1. Open Discord server settings
2. Integrations → Webhooks
3. Create webhook
4. Copy webhook URL

---

## Testing Secrets Configuration

After adding secrets, test by running a workflow:

### Option 1: Manual Workflow Run
1. Go to **Actions** tab
2. Select **Deploy to Production** workflow
3. Click **Run workflow**
4. Watch the deployment progress

### Option 2: Create a Tag
```bash
# On your local machine
cd C:\MDCLodging

# Create and push a tag
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

This triggers automatic deployment.

---

## Troubleshooting

### Error: "Host key verification failed"
**Cause:** Server not in GitHub Actions known_hosts
**Solution:** Add to workflow (already configured in deploy-production.yml)

### Error: "Permission denied (publickey)"
**Possible causes:**
1. Wrong private key in PROD_SSH_KEY
2. Public key not on server (`~/.ssh/authorized_keys`)
3. Wrong PROD_USER value

**Solution:**
1. Verify private key matches public key on server
2. Check key permissions on server: `chmod 600 ~/.ssh/authorized_keys`
3. Confirm username is `deploy`

### Error: "Connection timeout"
**Possible causes:**
1. Server firewall blocking GitHub Actions IPs
2. Wrong PROD_HOST value
3. Server offline

**Solution:**
1. Check UFW firewall allows port 22
2. Verify IP address in PROD_HOST
3. Test SSH locally: `ssh deploy@YOUR_SERVER_IP`

---

## Security Best Practices

### ✅ Do's
- ✅ Use separate SSH keys for deployment (not your personal key)
- ✅ Limit key to deploy user only (not root)
- ✅ Rotate keys periodically (every 6-12 months)
- ✅ Use read-only keys when possible
- ✅ Keep secrets.json local (never commit)

### ❌ Don'ts
- ❌ Never commit secrets to Git
- ❌ Don't share deployment keys
- ❌ Don't use same key for multiple servers
- ❌ Don't paste secrets in public channels
- ❌ Don't screenshot secrets

---

## Additional Secrets for Production

As you expand, you may need:

### SENTRY_DSN
**What:** Sentry error tracking integration
**When:** After setting up Sentry account
**Format:** `https://xxx@sentry.io/xxx`

### STRIPE_SECRET_KEY (Live)
**What:** Stripe production API key
**When:** After Stripe setup (see STRIPE_SETUP_GUIDE.md)
**Format:** `sk_live_...`

### CLOUDFLARE_API_TOKEN
**What:** For CDN and DNS automation
**When:** If using Cloudflare

### AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY
**What:** For S3 backup storage
**When:** If using AWS S3 for backups

---

## Secrets Summary Checklist

Before enabling automated deployments:

- [ ] PROD_HOST configured (server IP)
- [ ] PROD_USER configured (`deploy`)
- [ ] PROD_SSH_KEY configured (full private key)
- [ ] Secrets verified in GitHub Settings
- [ ] SSH access tested manually
- [ ] Workflow test run successful

---

## Quick Reference: Adding First Secret

```
1. https://github.com/marincarlosjavier/mdclodging/settings/secrets/actions
2. Click "New repository secret"
3. Name: PROD_HOST
4. Secret: YOUR_SERVER_IP
5. Click "Add secret"
6. Repeat for PROD_USER and PROD_SSH_KEY
```

---

## What Happens After Configuration

Once secrets are configured:

1. **Push to `main` branch** → Runs CI tests, builds Docker images
2. **Tag release** (e.g., `v1.0.0`) → Triggers production deployment
3. **GitHub Actions** → Connects to server, pulls images, restarts services
4. **Health Check** → Verifies deployment successful
5. **Notification** → Slack/Discord (if configured)

**Zero-downtime deployment:** ✅ Automatic

---

## Need Help?

**GitHub Actions not starting?**
- Check `.github/workflows/` files committed
- Verify branch name matches workflow (main/master)

**Deployment failing?**
- Check Actions tab for error logs
- Test SSH access manually
- Verify server has Docker installed

**Still stuck?**
- Review workflow logs in Actions tab
- Check server logs: `docker logs mdclodging_backend`
- Verify all 3 secrets added correctly

---

**Next Steps:**
1. Add the 3 required secrets
2. Test manual workflow run
3. Create production tag: `git tag v1.0.0`
4. Watch automated deployment! 🚀

---

**Last Updated:** 2026-01-26
**Required for:** CI/CD Automation
**Related Guides:** DEPLOYMENT_GUIDE.md, DEPLOYMENT_CHECKLIST.md
