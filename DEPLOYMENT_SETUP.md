# 🚀 Configuración de Deploy Automático

Este documento explica cómo configurar el deploy automático para que cada vez que hagas `git push`, se actualice producción automáticamente.

## 📋 Cómo funciona

```
1. Haces cambios en tu código
2. git add .
3. git commit -m "mensaje"
4. git push origin master      ← Aquí se activa el deploy automático
5. GitHub Actions ejecuta deploy.sh en el servidor
6. Producción actualizada ✅
```

## ⚙️ Configuración (solo una vez)

### Paso 1: Subir el script al servidor

Desde tu computadora:

```bash
# Copiar el script al servidor
scp -i ~/.ssh/aneldida_deploy scripts/deploy.sh deploy@161.35.134.50:/opt/mdclodging/scripts/

# Conectar al servidor
ssh -i ~/.ssh/aneldida_deploy deploy@161.35.134.50

# Dar permisos de ejecución
chmod +x /opt/mdclodging/scripts/deploy.sh

# Salir del servidor
exit
```

### Paso 2: Crear SSH key para GitHub

Desde tu computadora:

```bash
# Generar una nueva SSH key (SIN password)
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy_key

# Cuando pregunte por passphrase, presiona ENTER (dejar vacío)
```

### Paso 3: Agregar la key al servidor

```bash
# Copiar la key pública al servidor
ssh-copy-id -i ~/.ssh/github_deploy_key.pub deploy@161.35.134.50

# O manualmente:
cat ~/.ssh/github_deploy_key.pub
# Copiar el contenido y pegarlo en el servidor en:
# /home/deploy/.ssh/authorized_keys
```

### Paso 4: Configurar secretos en GitHub

1. Ve a tu repositorio en GitHub:
   ```
   https://github.com/marincarlosjavier/mdclodging
   ```

2. Click en **Settings** (arriba derecha)

3. En el menú izquierdo, click en **Secrets and variables** → **Actions**

4. Click en **New repository secret** y agrega estos 3 secretos:

   **Secreto 1:**
   - Name: `SERVER_HOST`
   - Value: `161.35.134.50`

   **Secreto 2:**
   - Name: `SERVER_USER`
   - Value: `deploy`

   **Secreto 3:**
   - Name: `SSH_PRIVATE_KEY`
   - Value: (copiar TODO el contenido de `~/.ssh/github_deploy_key`)

   Para ver el contenido:
   ```bash
   cat ~/.ssh/github_deploy_key
   ```

   Copiar desde `-----BEGIN OPENSSH PRIVATE KEY-----` hasta `-----END OPENSSH PRIVATE KEY-----` (incluir todo)

5. Click en **Add secret** para cada uno

### Paso 5: Probar el deploy

```bash
# Hacer un cambio pequeño para probar
echo "# Deploy automático configurado" >> README.md

# Commit y push
git add README.md
git commit -m "Test: automatic deployment"
git push origin master
```

Ahora:
1. Ve a tu repositorio en GitHub
2. Click en **Actions** (arriba)
3. Verás el deployment ejecutándose en tiempo real
4. Espera a que termine (debería tomar 1-2 minutos)
5. Si todo está ✅ verde, el deploy fue exitoso

## 📊 Ver el progreso del deploy

- **En GitHub:** `https://github.com/marincarlosjavier/mdclodging/actions`
- **En el servidor:** `ssh deploy@161.35.134.50 'docker logs mdclodging_backend --tail 50'`

## 🔧 Troubleshooting

### El deploy falla con "Permission denied"

```bash
# Verificar que la key esté en el servidor
ssh deploy@161.35.134.50 'cat ~/.ssh/authorized_keys'
# Debe aparecer la key github_deploy_key
```

### El script no tiene permisos

```bash
ssh deploy@161.35.134.50 'chmod +x /opt/mdclodging/scripts/deploy.sh'
```

### El deploy se queda en "Waiting for backend"

```bash
# Ver logs del backend
ssh deploy@161.35.134.50 'docker logs mdclodging_backend --tail 100'
```

## 📝 Flujo de trabajo diario

Una vez configurado:

```bash
# Trabaja normalmente
git add .
git commit -m "Agregué nueva funcionalidad"
git commit -m "Arreglé un bug"
git commit -m "Actualicé el frontend"

# Cuando estés listo, push
git push origin master

# Ve a GitHub Actions para ver el progreso
# Espera 1-2 minutos
# ¡Producción actualizada! 🎉
```

## 🎯 Lo que hace automáticamente

El script `deploy.sh` detecta automáticamente:

✅ Si cambiaron archivos del backend → Reconstruye backend
✅ Si cambiaron archivos del frontend → Reconstruye frontend
✅ Si hay nuevas migraciones de BD → Las ejecuta
✅ Verifica que API y Frontend respondan correctamente
✅ Si algo falla, muestra los logs y detiene el deploy

## ⚡ Ventajas

- ✅ Deploy automático en 1-2 minutos
- ✅ No necesitas SSH al servidor manualmente
- ✅ Logs de cada deploy en GitHub
- ✅ Si algo falla, no se actualiza producción
- ✅ Health checks automáticos
- ✅ Solo reconstruye lo que cambió (más rápido)

## 🚨 Importante

- Siempre revisa tus cambios antes de hacer push a master
- Si algo sale mal, los logs están en GitHub Actions
- El deploy solo se activa con push a `master`, no con commits locales
- Puedes ver el historial completo de deploys en GitHub Actions

---

**URLs importantes:**
- Frontend: https://app.aneldida.com
- API: https://api.aneldida.com
- GitHub Actions: https://github.com/marincarlosjavier/mdclodging/actions
