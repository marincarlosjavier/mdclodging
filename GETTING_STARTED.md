# Guía de Inicio Rápido - MDCLodging

Esta guía te ayudará a poner en marcha el sistema en menos de 10 minutos.

## Prerrequisitos

- Node.js >= 18
- pnpm >= 8 (o npm)
- Docker y Docker Compose
- Git

## Instalación Rápida

### Opción 1: Con Docker (Recomendado)

```bash
# 1. Clonar o navegar al proyecto
cd C:\MDCLodging

# 2. Copiar variables de entorno
copy .env.example packages\backend\.env

# 3. Iniciar servicios con Docker
docker-compose up -d

# 4. Esperar a que los servicios estén listos (30 segundos aprox)

# 5. Ejecutar migraciones
docker exec mdclodging_backend node src/database/migrate.js

# 6. Cargar datos iniciales
docker exec mdclodging_backend node src/database/seed.js
```

**¡Listo!** El sistema ya está corriendo:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Base de datos: localhost:5432

### Opción 2: Desarrollo Local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar PostgreSQL (con Docker)
docker-compose up -d postgres

# 3. Configurar backend
cd packages/backend
copy .env.example .env
# Editar .env si es necesario

# 4. Ejecutar migraciones y seed
pnpm migrate
pnpm seed

# 5. En terminal 1: Iniciar backend
pnpm dev

# 6. En terminal 2: Iniciar frontend
cd ../frontend
pnpm dev
```

## Primer Acceso

### Credenciales de Demo

```
URL: http://localhost:5173
Email: admin@demo.com
Password: admin123
Subdomain: demo
```

**Otros usuarios de prueba:**
- Supervisor: supervisor@demo.com / super123
- Housekeeping: maria@demo.com / maria123
- Mantenimiento: carlos@demo.com / carlos123

## Configurar Bot de Telegram (Opcional)

### 1. Crear Bot con BotFather

1. Abrir Telegram y buscar `@BotFather`
2. Enviar `/newbot`
3. Seguir instrucciones y elegir nombre y username
4. Copiar el **token** que te da BotFather

### 2. Configurar en el Sistema

1. Iniciar sesión como admin en http://localhost:5173
2. Ir a **Configuración** o editar `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   TELEGRAM_BOT_ENABLED=true
   TELEGRAM_BOT_USERNAME=tu_bot_username
   ```
3. Reiniciar backend:
   ```bash
   docker-compose restart backend
   # o
   # Ctrl+C y pnpm dev
   ```

### 3. Vincular Usuarios

1. En la web, ir a **Usuarios**
2. Crear o seleccionar un usuario
3. Click en **Generar código Telegram**
4. Copiar el código (ej: ABC12XYZ)
5. En Telegram, buscar tu bot y enviar `/start`
6. Enviar el código al bot
7. Configurar PIN de 4 dígitos
8. ¡Listo! Ya puedes recibir tareas en Telegram

## Crear Tareas - 3 Métodos

### Método 1: Interfaz Web

1. Ir a **Tareas** → **Nueva Tarea**
2. Llenar formulario
3. Asignar usuario
4. Guardar

### Método 2: Importar desde Excel

1. Ir a **Tareas**
2. Click **Template** para descargar plantilla
3. Llenar Excel con tus tareas
4. Click **Importar** y seleccionar archivo
5. Revisar resultado de importación

### Método 3: API REST

```bash
# Obtener token API del usuario
# (Ver en Configuración o solicitar a admin)

# Crear tarea
curl -X POST http://localhost:3000/api/tasks \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Limpieza habitación 101",
    "task_type": "cleaning",
    "location": "Piso 1",
    "room_number": "101",
    "priority": "high",
    "assigned_to": 1
  }'
```

## Verificar Instalación

### 1. Backend

```bash
curl http://localhost:3000/health
# Debe responder: {"status":"ok",...}
```

### 2. Base de Datos

```bash
# Con Docker
docker exec -it mdclodging_postgres psql -U postgres -d mdclodging -c "SELECT COUNT(*) FROM tenants;"

# Local
psql -U postgres -d mdclodging -c "SELECT COUNT(*) FROM tenants;"
```

### 3. Frontend

Abrir http://localhost:5173 en el navegador

## Solución de Problemas

### Backend no inicia

```bash
# Ver logs
docker-compose logs backend

# O si es local
cd packages/backend
pnpm dev
```

**Error común:** "Database connection error"
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `.env`

### Frontend muestra errores

```bash
# Reinstalar dependencias
cd packages/frontend
rm -rf node_modules
pnpm install
pnpm dev
```

### Bot de Telegram no responde

1. Verificar que el token sea correcto
2. Verificar que `TELEGRAM_BOT_ENABLED=true`
3. Reiniciar backend
4. Ver logs: `docker-compose logs backend | grep telegram`

## Próximos Pasos

1. **Crear usuarios reales**: Ir a Usuarios → Nuevo Usuario
2. **Configurar Telegram**: Seguir guía arriba
3. **Crear tareas**: Usar cualquiera de los 3 métodos
4. **Probar flujo completo**:
   - Crear tarea
   - Asignar a usuario con Telegram
   - Usuario recibe notificación
   - Usuario completa tarea desde Telegram
   - Ver tarea completada en web

## Estructura del Proyecto

```
MDCLodging/
├── packages/
│   ├── backend/         # API + Bot Telegram
│   │   ├── src/
│   │   │   ├── routes/      # Rutas API
│   │   │   ├── telegram/    # Bot Telegram
│   │   │   ├── database/    # Migraciones
│   │   │   └── services/    # Lógica de negocio
│   │   └── package.json
│   └── frontend/        # Admin React
│       ├── src/
│       │   ├── pages/       # Páginas
│       │   ├── components/  # Componentes
│       │   ├── services/    # API client
│       │   └── store/       # Redux
│       └── package.json
├── docker-compose.yml
└── README.md
```

## Soporte

Si encuentras problemas:
1. Revisa los logs: `docker-compose logs`
2. Verifica que todos los servicios estén corriendo: `docker-compose ps`
3. Revisa las variables de entorno en `.env`

## Recursos

- [Documentación API](./API.md) (próximamente)
- [Guía de Telegram Bot](./TELEGRAM.md) (próximamente)
- [Deployment en Producción](./DEPLOYMENT.md) (próximamente)

---

**¡Felicidades!** Ya tienes MDCLodging funcionando 🎉
