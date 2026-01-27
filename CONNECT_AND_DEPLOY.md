# 🚀 Conectar y Deployar Aneldida.com

**Tu servidor:** 161.35.134.50

---

## PASO 1: Conectarte al Servidor

Copia y pega este comando en tu terminal (Git Bash):

```bash
ssh -i ~/.ssh/aneldida_deploy root@161.35.134.50
```

**Primera vez?** Te preguntará:
```
The authenticity of host '161.35.134.50' can't be established.
Are you sure you want to continue connecting (yes/no)?
```

Escribe: **yes** y presiona Enter

**Deberías ver algo como:**
```
Welcome to Ubuntu 22.04.3 LTS
root@aneldida-prod:~#
```

✅ **¡Estás dentro del servidor!**

---

## PASO 2: Configurar el Servidor (Solo Primera Vez)

**Copia TODO este bloque y pégalo:**

```bash
curl -fsSL https://raw.githubusercontent.com/marincarlosjavier/mdclodging/master/server-setup.sh -o setup.sh
chmod +x setup.sh
bash setup.sh
```

**Esto instalará:**
- Node.js 18
- pnpm
- Docker
- Usuario "deploy"
- Firewall
- Utilidades

**Espera 3-5 minutos mientras instala...**

Cuando termine verás:
```
✅ Server setup complete!
```

---

## PASO 3: Salir y Reconectar como Deploy User

```bash
exit
```

Ahora conéctate como usuario "deploy":

```bash
ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50
```

Deberías ver:
```
deploy@aneldida-prod:~$
```

✅ **Ahora estás como deploy user**

---

## PASO 4: Descargar Script de Deploy

```bash
cd ~
curl -fsSL https://raw.githubusercontent.com/marincarlosjavier/mdclodging/master/deploy-aneldida.sh -o deploy.sh
chmod +x deploy.sh
```

---

## PASO 5: Deployar con tus Secrets

**IMPORTANTE:** Usa tus secrets reales (están en MY_DEPLOYMENT_PROGRESS.md)

```bash
JWT_SECRET='e6327fc78c321fb1df5ac5e20385382d862c67735c9f0ce755dba5763f25f8e1' \
DB_PASSWORD='OxrEpMSUUkThvbGyR2YXcAxx' \
bash deploy.sh
```

**Esto hará:**
1. Clonar repositorio
2. Instalar dependencias
3. Crear .env files
4. Build frontend
5. Correr migraciones
6. Generar SSL (puede fallar, está ok)
7. Configurar Nginx
8. Iniciar servicios
9. Configurar backups

**Espera 5-10 minutos...**

---

## PASO 6: Verificar que Funciona

```bash
docker compose -f /opt/mdclodging/docker-compose.prod.yml ps
```

Deberías ver:
```
NAME                    STATUS
mdclodging_backend      Up
mdclodging_frontend     Up
mdclodging_postgres     Up
mdclodging_nginx        Up
```

**Probar la API:**
```bash
curl http://localhost:3000/health
```

Debería responder:
```json
{"status":"ok","timestamp":"..."}
```

---

## PASO 7: Configurar DNS (IMPORTANTE!)

**Antes de que funcione HTTPS, necesitas:**

1. **Ve a tu registrador de dominio** (donde compraste aneldida.com)
2. **Agrega estos DNS records:**

```
Type: A
Name: app
Value: 161.35.134.50
TTL: 3600

Type: A
Name: api
Value: 161.35.134.50
TTL: 3600
```

**Esto puede tardar 1-48 horas en propagar.**

**Verifica propagación:**
```bash
nslookup app.aneldida.com
nslookup api.aneldida.com
```

Debe mostrar: `161.35.134.50`

---

## PASO 8: Generar SSL (Después de DNS)

**Una vez DNS esté propagado:**

```bash
sudo certbot certonly --standalone \
  -d app.aneldida.com \
  -d api.aneldida.com \
  --email admin@aneldida.com \
  --agree-tos \
  --non-interactive
```

**Copiar certificados:**
```bash
sudo mkdir -p /opt/mdclodging/nginx/ssl
sudo cp /etc/letsencrypt/live/app.aneldida.com/fullchain.pem /opt/mdclodging/nginx/ssl/
sudo cp /etc/letsencrypt/live/app.aneldida.com/privkey.pem /opt/mdclodging/nginx/ssl/
sudo chown -R deploy:deploy /opt/mdclodging/nginx/ssl
```

**Reiniciar Nginx:**
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml restart nginx
```

---

## ✅ LISTO!

**Abre en tu navegador:**
- https://app.aneldida.com
- https://api.aneldida.com/health

---

## 🔧 Comandos Útiles

**Ver logs:**
```bash
cd /opt/mdclodging
docker compose -f docker-compose.prod.yml logs -f
```

**Ver solo backend:**
```bash
docker logs mdclodging_backend -f
```

**Reiniciar servicios:**
```bash
docker compose -f docker-compose.prod.yml restart
```

**Detener todo:**
```bash
docker compose -f docker-compose.prod.yml down
```

**Iniciar todo:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## ❌ Si Algo Falla

**Script de setup falló?**
```bash
# Volver a correr
bash setup.sh
```

**Deploy falló?**
```bash
# Ver qué pasó
docker compose -f /opt/mdclodging/docker-compose.prod.yml logs
```

**Migraciones fallaron?**
```bash
cd /opt/mdclodging/packages/backend
node src/database/migrate.js
```

---

**¿Listo para empezar?**

Ejecuta el comando del PASO 1:
```bash
ssh -i ~/.ssh/aneldida_deploy root@161.35.134.50
```

¡Y sigue los pasos! 🚀
