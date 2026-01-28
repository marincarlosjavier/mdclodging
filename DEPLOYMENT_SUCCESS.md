# 🎉 Deployment Successful!

Your MDCLodging application is now live on the internet!

---

## 🌐 Access Your Application

### Frontend (Web Application)
**URL:** https://app.aneldida.com

Open this in your browser to access the web interface.

### API (Backend)
**Base URL:** https://api.aneldida.com

**Health Check:** https://api.aneldida.com/health

---

## ✅ What's Working

- ✅ **SSL/HTTPS** - Secure connections with Let's Encrypt certificates
- ✅ **Database** - PostgreSQL 16 with all 40 migrations applied
- ✅ **Backend API** - Node.js backend serving API requests
- ✅ **Frontend** - React application served with Nginx
- ✅ **Reverse Proxy** - Nginx handling routing and SSL termination
- ✅ **Auto-renewal** - SSL certificates renew automatically every 3 months
- ✅ **Security Headers** - HSTS, X-Frame-Options, X-Content-Type-Options
- ✅ **Rate Limiting** - Protection against API abuse

---

## 🔑 Next Steps

### 1. Create Your First Admin User

Connect to your server:
```bash
ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50
```

Access the database:
```bash
docker exec -it mdclodging_postgres psql -U mdclodging -d mdclodging
```

Create an admin user (replace with your details):
```sql
-- Check existing users
SELECT id, username, email, role FROM users;

-- If you need to create a new admin user, first register through the app
-- Then promote them to admin:
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Exit psql:
```
\q
```

### 2. Test the Application

1. Open **https://app.aneldida.com** in your browser
2. Try registering a new account
3. Log in with your credentials
4. Explore the dashboard

### 3. Check Container Status

```bash
ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml ps
```

### 4. View Logs

Backend logs:
```bash
docker logs mdclodging_backend -f
```

Nginx logs:
```bash
docker logs mdclodging_nginx -f
```

All logs:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🛠️ Useful Commands

### SSH to Server
```bash
# As deploy user (recommended)
ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50

# As root (for admin tasks)
ssh -i ~/.ssh/aneldida_deploy root@161.35.134.50
```

### Restart Services
```bash
cd /opt/mdclodging

# Restart all containers
docker compose -f docker-compose.prod.yml restart

# Restart specific container
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart nginx
```

### Stop/Start Application
```bash
cd /opt/mdclodging

# Stop everything
docker compose -f docker-compose.prod.yml down

# Start everything
docker compose -f docker-compose.prod.yml up -d

# View status
docker compose -f docker-compose.prod.yml ps
```

### Update Application
```bash
cd /opt/mdclodging

# Pull latest code
git pull origin master

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build backend

# Run new migrations (if any)
docker exec mdclodging_backend node src/database/migrate.js
```

### Database Backup
```bash
# Create backup
docker exec mdclodging_postgres pg_dump -U mdclodging mdclodging > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20260128.sql | docker exec -i mdclodging_postgres psql -U mdclodging -d mdclodging
```

---

## 📊 Monitoring

### Check Health
```bash
# API health check
curl https://api.aneldida.com/health

# Should return: {"status":"ok","timestamp":"...","uptime":...}
```

### Resource Usage
```bash
# Container resource usage
docker stats

# Disk usage
df -h

# Memory usage
free -h
```

---

## 🔒 Security Notes

**Important:** Your application is now publicly accessible on the internet!

- ✅ SSL/HTTPS is enabled and enforced
- ✅ Security headers are configured
- ✅ Rate limiting is active on API endpoints
- ⚠️ Change default admin password immediately
- ⚠️ Keep your JWT_SECRET and DB_PASSWORD secret
- ⚠️ Never commit .env files to Git
- ⚠️ Regularly update your server and packages

---

## 📝 Configuration Files

**Backend Environment:** `/opt/mdclodging/packages/backend/.env`
**Docker Compose:** `/opt/mdclodging/docker-compose.prod.yml`
**Nginx Config:** `/opt/mdclodging/nginx/nginx.conf`
**SSL Certificates:** `/opt/mdclodging/nginx/ssl/`

---

## 🆘 Troubleshooting

### Application not responding
```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check logs for errors
docker compose -f docker-compose.prod.yml logs --tail 50

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Database connection errors
```bash
# Check PostgreSQL is running
docker exec mdclodging_postgres pg_isready -U mdclodging

# Check database exists
docker exec mdclodging_postgres psql -U mdclodging -l
```

### SSL certificate issues
```bash
# Check certificate validity
openssl s_client -connect api.aneldida.com:443 -servername api.aneldida.com

# Manual certificate renewal
docker compose -f docker-compose.prod.yml run --rm certbot renew

# Copy certificates
sudo cp /etc/letsencrypt/live/app.aneldida.com/*.pem /opt/mdclodging/nginx/ssl/
sudo chown -R deploy:deploy /opt/mdclodging/nginx/ssl
```

### Can't SSH to server
```bash
# Test connection
ssh -v -i ~/.ssh/aneldida_deploy deploy@161.35.134.50

# Check key permissions
ls -la ~/.ssh/aneldida_deploy
# Should be: -rw------- (600)

# Fix permissions if needed
chmod 600 ~/.ssh/aneldida_deploy
```

---

## 🎯 Optional Enhancements

The following features are **not yet configured** but can be added later:

- [ ] **Monitoring:** Prometheus + Grafana for metrics and dashboards
- [ ] **Backups:** Automated daily database backups to S3 or Spaces
- [ ] **CI/CD:** GitHub Actions for automated deployments
- [ ] **Email:** SMTP configuration for transactional emails
- [ ] **Telegram Bot:** Enable the housekeeping bot integration
- [ ] **Payments:** Stripe integration for billing
- [ ] **Analytics:** Google Analytics or Plausible
- [ ] **Error Tracking:** Sentry for error monitoring

---

## 📞 Support

**Repository:** https://github.com/marincarlosjavier/mdclodging
**Server IP:** 161.35.134.50
**Domain:** aneldida.com

---

**Deployed:** 2026-01-28
**SSL Valid Until:** 2026-04-28 (auto-renews)

🎉 **Congratulations! Your application is live!**
