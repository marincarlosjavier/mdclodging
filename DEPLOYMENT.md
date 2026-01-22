# Guía de Despliegue en Producción

Guía para desplegar MDCLodging en producción.

## Preparación

### 1. Requisitos del Servidor

- **CPU**: 2+ cores
- **RAM**: 4GB mínimo, 8GB recomendado
- **Disco**: 20GB mínimo
- **OS**: Ubuntu 22.04 LTS / Debian 11+ / CentOS 8+
- **Software**:
  - Docker 20+
  - Docker Compose 2+
  - Git

### 2. Dominio y DNS

Configurar registros DNS:

```
# Ejemplo con subdominio por tenant
demo.tuhotel.com     A      xxx.xxx.xxx.xxx
hotel1.tuhotel.com   A      xxx.xxx.xxx.xxx
*.tuhotel.com        A      xxx.xxx.xxx.xxx  (wildcard)
```

### 3. Certificados SSL

Usar Let's Encrypt con Certbot:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d tuhotel.com -d *.tuhotel.com
```

## Opción 1: Docker Compose (Recomendado)

### 1. Clonar Repositorio

```bash
cd /opt
git clone https://github.com/tu-org/mdclodging.git
cd mdclodging
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example packages/backend/.env
nano packages/backend/.env
```

**Configuración crítica:**

```env
# CAMBIAR EN PRODUCCIÓN
JWT_SECRET=genera_un_secret_aleatorio_de_64_caracteres_aqui

# Base de datos
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@postgres:5432/mdclodging

# CORS
CORS_ORIGIN=https://tuhotel.com

# Telegram (si aplica)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_BOT_ENABLED=true
TELEGRAM_BOT_USERNAME=tu_bot
```

**Generar JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Modificar docker-compose.yml

Agregar volúmenes persistentes y configuración de producción:

```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # Usar variable
    restart: always

  backend:
    environment:
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
    restart: always

  frontend:
    restart: always
```

### 4. Iniciar Servicios

```bash
# Build e iniciar
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Verificar estado
docker-compose ps
```

### 5. Ejecutar Migraciones

```bash
docker exec mdclodging_backend node src/database/migrate.js
docker exec mdclodging_backend node src/database/seed.js
```

### 6. Configurar Nginx como Reverse Proxy

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/mdclodging
```

```nginx
server {
    listen 80;
    server_name tuhotel.com *.tuhotel.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tuhotel.com *.tuhotel.com;

    ssl_certificate /etc/letsencrypt/live/tuhotel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tuhotel.com/privkey.pem;

    # SSL Security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mdclodging /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Opción 2: Despliegue Manual

### Backend

```bash
cd packages/backend
npm ci --only=production
pm2 start src/server.js --name mdclodging-api
pm2 save
pm2 startup
```

### Frontend

```bash
cd packages/frontend
npm ci
npm run build
# Copiar dist/ a servidor web
```

## Seguridad

### 1. Firewall

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 2. Fail2Ban (protección contra ataques)

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 3. Backups Automáticos

```bash
#!/bin/bash
# /opt/scripts/backup-mdclodging.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mdclodging"

# Backup base de datos
docker exec mdclodging_postgres pg_dump -U postgres mdclodging > "$BACKUP_DIR/db_$DATE.sql"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" /opt/mdclodging/packages/backend/uploads

# Mantener solo últimos 7 días
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completado: $DATE"
```

```bash
# Agregar a cron (diario a las 3am)
crontab -e
0 3 * * * /opt/scripts/backup-mdclodging.sh
```

## Monitoreo

### 1. Health Checks

```bash
# Script de monitoreo
#!/bin/bash
# /opt/scripts/health-check.sh

if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Backend down! Restarting..."
    docker-compose -f /opt/mdclodging/docker-compose.yml restart backend
fi
```

### 2. Logs

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de servicio específico
docker-compose logs -f backend

# Logs de últimas 100 líneas
docker-compose logs --tail=100 backend
```

## Actualizaciones

```bash
cd /opt/mdclodging

# 1. Backup antes de actualizar
./scripts/backup.sh

# 2. Pull cambios
git pull origin main

# 3. Rebuild y reiniciar
docker-compose down
docker-compose up -d --build

# 4. Ejecutar nuevas migraciones
docker exec mdclodging_backend node src/database/migrate.js

# 5. Verificar
curl http://localhost:3000/health
```

## Escalabilidad

### Múltiples Instancias (Load Balancer)

```nginx
upstream backend_cluster {
    least_conn;
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    location /api/ {
        proxy_pass http://backend_cluster;
    }
}
```

### Base de Datos

- **Read Replicas**: PostgreSQL streaming replication
- **Connection Pooling**: PgBouncer
- **Monitoring**: pg_stat_statements

## Troubleshooting

### Backend no responde

```bash
docker-compose logs backend
docker-compose restart backend
```

### Base de datos llena

```bash
# Ver tamaño
docker exec mdclodging_postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('mdclodging'));"

# Vacuum
docker exec mdclodging_postgres psql -U postgres mdclodging -c "VACUUM ANALYZE;"
```

### Bot de Telegram caído

```bash
docker-compose restart backend
docker-compose logs backend | grep telegram
```

## Checklist Pre-Producción

- [ ] JWT_SECRET único y seguro
- [ ] Contraseñas de BD fuertes
- [ ] SSL configurado
- [ ] Firewall activo
- [ ] Backups automáticos
- [ ] Monitoreo configurado
- [ ] Variables de entorno revisadas
- [ ] Pruebas de carga realizadas
- [ ] Plan de rollback definido
- [ ] Documentación actualizada

## Soporte

En caso de problemas en producción:
1. Revisar logs: `docker-compose logs`
2. Verificar health: `curl localhost:3000/health`
3. Revisar recursos: `docker stats`
4. Contactar al equipo de desarrollo
