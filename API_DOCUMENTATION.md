# Documentación API - MDCLodging

API REST para integración con sistemas externos.

## Autenticación

Todas las peticiones (excepto login) requieren autenticación mediante:

### 1. JWT Token (Frontend)

```bash
Authorization: Bearer {token}
```

### 2. API Token (Integraciones externas)

```bash
X-API-Token: {api_token}
```

**Obtener API Token:**
- Admin web → Usuarios → Regenerar API Token
- O solicitar a un administrador

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### Autenticación

#### POST /auth/login

Login de usuario.

**Request:**
```json
{
  "email": "admin@demo.com",
  "password": "admin123",
  "subdomain": "demo"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@demo.com",
    "full_name": "Admin Demo",
    "role": "admin",
    "tenant": {
      "id": 1,
      "name": "Hotel Demo",
      "subdomain": "demo"
    }
  }
}
```

### Tareas

#### GET /tasks

Listar tareas.

**Query Parameters:**
- `status`: pending | in_progress | completed | cancelled
- `priority`: low | medium | high | urgent
- `task_type`: cleaning | maintenance | inspection | other
- `assigned_to`: user_id

**Example:**
```bash
curl http://localhost:3000/api/tasks?status=pending&priority=high \
  -H "X-API-Token: YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "title": "Limpieza habitación 101",
    "description": "Limpieza profunda después de check-out",
    "status": "pending",
    "priority": "high",
    "task_type": "cleaning",
    "location": "Piso 1",
    "room_number": "101",
    "assigned_to": 3,
    "created_by": 1,
    "due_date": "2024-01-25T14:00:00Z",
    "created_at": "2024-01-24T10:00:00Z"
  }
]
```

#### POST /tasks

Crear nueva tarea.

**Request:**
```json
{
  "title": "Reparar aire acondicionado",
  "description": "No enfría correctamente",
  "task_type": "maintenance",
  "location": "Piso 2",
  "room_number": "205",
  "priority": "urgent",
  "assigned_to": 4,
  "due_date": "2024-01-25T10:00:00Z",
  "estimated_duration": 60
}
```

**Required fields:**
- `title`
- `task_type`
- `location`
- `priority`

**Response:** Task object

#### PUT /tasks/:id

Actualizar tarea.

**Request:**
```json
{
  "status": "in_progress",
  "notes": "Iniciando reparación"
}
```

#### PATCH /tasks/:id/status

Actualizar solo el estado (más rápido para trabajadores).

**Request:**
```json
{
  "status": "completed"
}
```

#### DELETE /tasks/:id

Eliminar tarea (solo admin/supervisor).

#### POST /tasks/import-excel

Importar tareas desde Excel.

**Request:**
```bash
curl -X POST http://localhost:3000/api/tasks/import-excel \
  -H "X-API-Token: YOUR_TOKEN" \
  -F "file=@tasks.xlsx"
```

**Response:**
```json
{
  "message": "Import completed",
  "total_rows": 10,
  "imported": 8,
  "failed": 2,
  "errors": [
    {
      "row": 3,
      "title": "Tarea inválida",
      "error": "Prioridad inválida"
    }
  ]
}
```

#### GET /tasks/template

Descargar template Excel para importación.

```bash
curl http://localhost:3000/api/tasks/template \
  -H "X-API-Token: YOUR_TOKEN" \
  --output tasks_template.xlsx
```

### Usuarios

#### GET /users

Listar usuarios del tenant.

**Query Parameters:**
- `role`: admin | supervisor | housekeeping | maintenance
- `is_active`: true | false

#### POST /users

Crear nuevo usuario (admin/supervisor).

**Request:**
```json
{
  "email": "juan@hotel.com",
  "password": "password123",
  "full_name": "Juan Pérez",
  "role": "housekeeping"
}
```

#### PUT /users/:id

Actualizar usuario.

#### DELETE /users/:id

Desactivar usuario (admin only).

### Telegram

#### GET /telegram/status

Estado del bot.

**Response:**
```json
{
  "enabled": true,
  "running": true,
  "username": "mi_hotel_bot"
}
```

#### POST /telegram/generate-link-code

Generar código de vinculación.

**Request:**
```json
{
  "user_id": 3
}
```

**Response:**
```json
{
  "code": "ABC12XYZ",
  "expires_at": "2024-01-25T10:00:00Z",
  "user": {
    "id": 3,
    "full_name": "María López",
    "role": "housekeeping"
  }
}
```

## Ejemplos de Integración

### Python

```python
import requests

API_URL = "http://localhost:3000/api"
API_TOKEN = "your-api-token"

headers = {
    "X-API-Token": API_TOKEN,
    "Content-Type": "application/json"
}

# Crear tarea
task_data = {
    "title": "Limpieza habitación 301",
    "task_type": "cleaning",
    "location": "Piso 3",
    "room_number": "301",
    "priority": "medium",
    "assigned_to": 3
}

response = requests.post(
    f"{API_URL}/tasks",
    json=task_data,
    headers=headers
)

print(response.json())
```

### Node.js

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000/api';
const API_TOKEN = 'your-api-token';

const headers = {
  'X-API-Token': API_TOKEN,
  'Content-Type': 'application/json'
};

// Listar tareas pendientes
async function getPendingTasks() {
  const response = await axios.get(`${API_URL}/tasks?status=pending`, { headers });
  return response.data;
}

// Crear tarea
async function createTask(taskData) {
  const response = await axios.post(`${API_URL}/tasks`, taskData, { headers });
  return response.data;
}

getPendingTasks().then(tasks => {
  console.log('Tareas pendientes:', tasks.length);
});
```

### PHP

```php
<?php

$apiUrl = 'http://localhost:3000/api';
$apiToken = 'your-api-token';

$headers = [
    'X-API-Token: ' . $apiToken,
    'Content-Type: application/json'
];

// Crear tarea
$taskData = [
    'title' => 'Limpieza habitación 401',
    'task_type' => 'cleaning',
    'location' => 'Piso 4',
    'room_number' => '401',
    'priority' => 'high',
    'assigned_to' => 3
];

$ch = curl_init($apiUrl . '/tasks');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($taskData));
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

## Códigos de Estado

- `200 OK`: Operación exitosa
- `201 Created`: Recurso creado
- `400 Bad Request`: Datos inválidos
- `401 Unauthorized`: No autenticado
- `403 Forbidden`: Sin permisos
- `404 Not Found`: Recurso no encontrado
- `409 Conflict`: Conflicto (ej: email duplicado)
- `500 Internal Server Error`: Error del servidor

## Rate Limiting

- Límite: 100 peticiones por 15 minutos por token
- Headers de respuesta:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Webhooks (Próximamente)

Configurar webhooks para recibir notificaciones en tiempo real:
- Tarea creada
- Tarea completada
- Usuario vinculado a Telegram
