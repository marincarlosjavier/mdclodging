# 🏨 MDCLodging - Sistema de Gestión Hotelera

> Sistema completo de gestión hotelera multi-tenant con Bot de Telegram integrado

[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://docker.com)

## 🌟 Características Principales

### 🏢 Multi-Tenant SaaS
- Múltiples hoteles en una sola instancia
- Aislamiento completo de datos por tenant
- Subdominio único por hotel
- Gestión independiente de configuraciones

### 🤖 Bot de Telegram
- Vinculación segura con códigos temporales
- Autenticación con PIN de 4 dígitos
- Gestión completa de tareas desde el móvil
- Notificaciones en tiempo real
- Soporte de fotos antes/después

### 📋 Gestión de Tareas - 3 Métodos
1. **Interfaz Web**: Panel admin responsive
2. **Importación Excel**: Carga masiva con validación
3. **API REST**: Integración con sistemas externos

### 👥 Sistema de Roles
- **Admin**: Acceso completo al sistema
- **Supervisor**: Gestión de tareas y usuarios
- **Housekeeping**: Ejecución de tareas de limpieza
- **Mantenimiento**: Ejecución de tareas de mantenimiento

### 📊 Características Avanzadas
- Dashboard con métricas en tiempo real
- Historial completo de cambios (audit trail)
- Prioridades y estados personalizables
- Fechas límite y estimaciones de tiempo
- Filtros y búsqueda avanzada
- 📱 **Mobile-first**: Diseño optimizado para móviles
- 📸 **Fotos**: Soporte de imágenes antes/después
- 🔒 **Seguridad**: JWT, bcrypt, validación de entrada

## Tecnologías

- **Backend**: Node.js + Express + PostgreSQL
- **Frontend**: React + Vite + Tailwind CSS
- **Bot**: Telegraf (Telegram Bot Framework)
- **Database**: PostgreSQL con multi-tenancy
- **Container**: Docker + Docker Compose

## Estructura del Proyecto

```
MDCLodging/
├── packages/
│   ├── backend/          # API Express + Telegram Bot
│   └── frontend/         # React Admin Panel
├── docker-compose.yml    # Orquestación de servicios
└── pnpm-workspace.yaml   # Configuración monorepo
```

## Inicio Rápido

### Requisitos Previos

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL 16 (o usar Docker)

### Instalación

```bash
# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp packages/backend/.env.example packages/backend/.env

# Iniciar base de datos con Docker
docker-compose up -d postgres

# Ejecutar migraciones
cd packages/backend
pnpm migrate

# Iniciar desarrollo
cd ../..
pnpm dev
```

### Configurar Bot de Telegram

1. Crear bot con [@BotFather](https://t.me/botfather)
2. Copiar token y añadir a `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=tu_token_aqui
   TELEGRAM_BOT_ENABLED=true
   ```
3. Reiniciar backend

## Uso

### Crear Tenant (Hotel)

```bash
# Ejecutar seed inicial (crea primer tenant y admin)
cd packages/backend
pnpm seed
```

### Vincular Usuario con Telegram

1. Admin web → Usuarios → Crear usuario
2. Click "Generar código Telegram"
3. Usuario en Telegram → Buscar bot → `/start`
4. Enviar código de vinculación
5. Configurar PIN de 4 dígitos

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Desarrollo (backend + frontend)
pnpm dev

# Build producción
pnpm build

# Limpiar
pnpm clean
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/register-tenant` - Registrar nuevo tenant

### Usuarios
- `GET /api/users` - Listar usuarios del tenant
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario

### Tareas
- `GET /api/tasks` - Listar tareas
- `POST /api/tasks` - Crear tarea (JSON)
- `POST /api/tasks/import-excel` - Importar tareas desde Excel
- `GET /api/tasks/template` - Descargar template Excel
- `PUT /api/tasks/:id` - Actualizar tarea
- `DELETE /api/tasks/:id` - Eliminar tarea

#### Crear Tareas - 3 Métodos

**1. Frontend Web**
- Interfaz visual con formulario
- Asignación directa a usuarios
- Adjuntar fotos

**2. Importación Excel**
- Descargar template: `GET /api/tasks/template`
- Llenar datos (título, ubicación, prioridad, etc.)
- Importar: `POST /api/tasks/import-excel`
- Mapeo automático de columnas

**3. API REST**
```bash
curl -X POST https://api.mdclodging.com/api/tasks \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Limpieza habitación 205",
    "task_type": "cleaning",
    "location": "205",
    "priority": "high",
    "assigned_to": "user@example.com"
  }'
```

### Telegram
- `GET /api/telegram/status` - Estado del bot
- `POST /api/telegram/start` - Iniciar bot
- `POST /api/telegram/generate-link-code` - Generar código vinculación
- `GET /api/telegram/contacts` - Listar contactos vinculados

## Arquitectura Multi-Tenant

Cada tenant (hotel) tiene:
- Datos aislados por `tenant_id`
- Usuarios y tareas separados
- Configuración de bot independiente
- Subdominio propio (opcional)

## Licencia

Propietario - Todos los derechos reservados

## Soporte

Para soporte, contactar al administrador del sistema.
 
 
