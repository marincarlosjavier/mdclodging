# 🎯 DigitalOcean Setup - Paso a Paso

## ✅ YA TIENES:
- Llave SSH generada
- Domain: aneldida.com
- Secrets generados

---

## 📝 PASO 1: Crear Cuenta DigitalOcean

1. Ve a: **https://www.digitalocean.com/**
2. Click **"Sign Up"** (esquina superior derecha)
3. Opciones de registro:
   - Email + Password
   - O "Sign up with Google"
   - O "Sign up with GitHub" (más rápido)
4. Verifica tu email
5. **Agregar método de pago** (tarjeta de crédito requerida)
   - No te cobran hasta que uses recursos
   - El droplet cuesta $12/mes (cobran por hora)

**¿Ya tienes cuenta?** Salta al Paso 2

---

## 🖥️ PASO 2: Crear tu Droplet

### 2.1 Iniciar Creación

1. En el dashboard, click **"Create"** (botón verde arriba derecha)
2. Selecciona **"Droplets"**

### 2.2 Elegir Imagen

**Choose an image:**
- Click pestaña **"Marketplace"**
- Busca **"Docker"**
- Selecciona **"Docker on Ubuntu 22.04"**

(Esto instala Docker automáticamente!)

### 2.3 Elegir Plan

**Choose Size:**

1. Click **"Basic"** (primero)
2. **CPU options:** Selecciona **"Regular"** (más barato)
3. **Precio:** Busca el de **$12/mo** o **$14/mo**
   - 2 GB RAM / 1 vCPU / 50 GB SSD
   - Debería decir: "$0.018/hour" o "$12/mo"

### 2.4 Elegir Región

**Choose a datacenter region:**

Para Colombia, elige:
- **New York 3** (NYC3) - Mejor latencia a Colombia
- O **San Francisco 3** (SFO3) - También bueno

Evita: Amsterdam, London (muy lejos)

### 2.5 Agregar SSH Key

**Authentication:**

1. Selecciona **"SSH Key"** (NO "Password")
2. Click **"New SSH Key"**
3. **Copia esta llave exacta:**

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEcsRSUJIk6uK3H03/KZcXZ2DxW9W0mW6G4IdEpynNbn aneldida-deploy
```

4. Pégala en el campo
5. **Name:** aneldida-deploy
6. Click **"Add SSH Key"**
7. ✅ Asegúrate que quede seleccionada (checkbox marcado)

### 2.6 Opciones Finales

**Additional Options:** (opcional, puedes saltar)
- [ ] IPv6 (no necesario)
- [x] Monitoring (gratis, recomendado) ← Marca esto

**Finalize Details:**
- **Quantity:** 1 Droplet
- **Hostname:** aneldida-prod
- **Tags:** (opcional) production, mdclodging

### 2.7 Crear!

1. Click **"Create Droplet"** (botón verde abajo)
2. **Espera 1-2 minutos** mientras se crea

---

## 🎉 PASO 3: Anotar IP del Servidor

Una vez creado verás:

```
aneldida-prod
●  Active
IPv4: 164.92.XXX.XXX  ← COPIA ESTO!
```

**IP de tu servidor:** _________________ (cópiala)

---

## 🔗 PASO 4: Probar Conexión

Una vez tengas la IP, dime:

**"Mi IP es: XXX.XXX.XXX.XXX"**

Y te daré el siguiente comando para conectarte.

---

## 💡 Tips

**¿Te pide tarjeta de crédito pero no tienes?**
- Prueba Heroku (tiene plan gratuito)
- O Railway (acepta más métodos de pago)

**¿El droplet más barato es $14 en vez de $12?**
- Está bien! A veces varía por región
- Ambos funcionan perfectamente

**¿No ves la opción de $12?**
- En "Choose Size", asegúrate de estar en "Basic" → "Regular"
- Scroll hacia abajo, puede estar más abajo

---

**¿Terminaste de crear el Droplet?**

Dime: **"Listo, mi IP es: XXX.XXX.XXX.XXX"**

Y continuamos con la configuración! 🚀
