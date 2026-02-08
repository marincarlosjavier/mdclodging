# 🔄 Manejo Inteligente de Conflictos en Registro de Tenant

## 📋 Descripción General

El sistema ahora detecta y maneja múltiples escenarios de conflicto durante el registro de tenant, proporcionando soluciones contextuales y mensajes específicos para cada situación.

---

## 🎯 Escenarios Manejados

### 1. **Cuenta Existente Completa** (`account_exists`)

**Situación:** El email ya está registrado con una cuenta activa.

**Respuesta del API:**
```json
{
  "error": "Ya tienes una cuenta registrada con este email.",
  "conflict_type": "account_exists",
  "details": {
    "email": "admin@hotel.com",
    "tenant_name": "Hotel Paradise",
    "subdomain": "hotelparadise123",
    "registered_date": "2024-01-15T10:30:00Z"
  },
  "suggestions": [
    {
      "action": "login",
      "text": "¿Olvidaste tu contraseña? Recupérala aquí",
      "url": "/forgot-password"
    },
    {
      "action": "use_different_email",
      "text": "Registrar otra empresa con email diferente"
    }
  ]
}
```

**UI Recomendada:**
```jsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
  <h3 className="text-lg font-semibold text-blue-900 mb-2">
    Ya tienes una cuenta
  </h3>
  <p className="text-sm text-blue-800 mb-4">
    El email <strong>{details.email}</strong> ya está registrado para{' '}
    <strong>{details.tenant_name}</strong> desde{' '}
    {formatDate(details.registered_date)}.
  </p>

  <div className="space-y-2">
    <button
      onClick={() => navigate('/forgot-password')}
      className="w-full btn btn-primary"
    >
      🔑 ¿Olvidaste tu contraseña? Recupérala aquí
    </button>

    <button
      onClick={() => setShowEmailInput(true)}
      className="w-full btn btn-outline"
    >
      ✉️ Usar otro email para registrar nueva empresa
    </button>
  </div>
</div>
```

---

### 2. **Registro Incompleto** (`incomplete_registration`)

**Situación:** El tenant existe pero no tiene usuario admin (registro abandonado).

**Respuesta del API:**
```json
{
  "error": "Encontramos un registro incompleto. Vamos a completarlo.",
  "conflict_type": "incomplete_registration",
  "details": {
    "tenant_id": 5,
    "tenant_name": "Mi Hotel",
    "can_complete": true
  },
  "suggestions": [
    {
      "action": "complete_registration",
      "text": "Completar registro automáticamente"
    }
  ]
}
```

**Flujo Frontend:**
```jsx
// 1. Mostrar mensaje de recuperación
<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
  <h3 className="text-lg font-semibold text-yellow-900 mb-2">
    ⚠️ Registro Incompleto Detectado
  </h3>
  <p className="text-sm text-yellow-800 mb-4">
    Encontramos que iniciaste el registro de <strong>{details.tenant_name}</strong> pero
    no se completó. ¿Quieres continuar donde lo dejaste?
  </p>

  <button
    onClick={handleCompleteRegistration}
    className="w-full btn btn-warning"
  >
    ✅ Completar Registro Ahora
  </button>
</div>

// 2. Función para completar registro
const handleCompleteRegistration = async () => {
  setLoading(true);

  try {
    // Reenviar con flag force_complete
    const response = await api.post('/auth/register-tenant', {
      ...originalFormData,
      force_complete: true  // ← Flag importante
    });

    // Éxito - redirigir al dashboard
    toast.success('¡Registro completado exitosamente!');
    navigate('/dashboard');

  } catch (error) {
    toast.error('Error al completar registro');
  } finally {
    setLoading(false);
  }
};
```

---

### 3. **Subdomain Ocupado** (`subdomain_taken`)

**Situación:** El subdomain solicitado ya está en uso por otra empresa.

**Respuesta del API:**
```json
{
  "error": "Este subdominio ya está en uso por otra empresa.",
  "conflict_type": "subdomain_taken",
  "details": {
    "subdomain": "mihotel",
    "suggested_alternatives": [
      "mihotel2",
      "mihotel2024",
      "mihotel456"
    ]
  },
  "suggestions": [
    {
      "action": "use_different_subdomain",
      "text": "Usar un subdominio diferente"
    },
    {
      "action": "auto_generate",
      "text": "Generar subdominio único automáticamente"
    }
  ]
}
```

**UI Recomendada:**
```jsx
<div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
  <h3 className="text-lg font-semibold text-orange-900 mb-2">
    Subdominio No Disponible
  </h3>
  <p className="text-sm text-orange-800 mb-4">
    El subdominio <code className="px-2 py-1 bg-orange-100 rounded">{details.subdomain}</code>{' '}
    ya está en uso. Te sugerimos estas alternativas:
  </p>

  <div className="space-y-2 mb-4">
    {details.suggested_alternatives.map((alt, index) => (
      <button
        key={index}
        onClick={() => retryWithSubdomain(alt)}
        className="w-full text-left px-4 py-2 bg-white border border-orange-300 rounded hover:bg-orange-50"
      >
        🔗 {alt}.tudominio.com
      </button>
    ))}
  </div>

  <button
    onClick={handleAutoGenerate}
    className="w-full btn btn-primary"
  >
    🎲 Generar Subdominio Único Automáticamente
  </button>
</div>
```

---

## 🛠️ Implementación en el Frontend

### Ejemplo Completo de Componente

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function TenantRegistrationForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tenant_name: '',
    subdomain: '',
    tenant_email: '',
    tenant_phone: '',
    admin_name: '',
    admin_email: '',
    admin_password: ''
  });
  const [conflict, setConflict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevenir doble-click

  const handleSubmit = async (e, options = {}) => {
    e.preventDefault();

    // Prevenir doble-click
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLoading(true);

    try {
      const response = await api.post('/auth/register-tenant', {
        ...formData,
        ...options // Para flags como force_complete
      });

      // Éxito
      toast.success(response.data.message);
      localStorage.setItem('token', response.data.token);
      navigate('/dashboard');

    } catch (error) {
      if (error.response?.status === 409) {
        // Conflicto detectado
        const conflictData = error.response.data;
        setConflict(conflictData);

        // Scroll al mensaje de error
        document.getElementById('conflict-message')?.scrollIntoView({
          behavior: 'smooth'
        });
      } else {
        toast.error(error.response?.data?.error || 'Error al registrar');
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false); // Re-habilitar después de 2 segundos como seguridad extra
      setTimeout(() => setIsSubmitting(false), 2000);
    }
  };

  const handleCompleteRegistration = () => {
    handleSubmit({ preventDefault: () => {} }, { force_complete: true });
  };

  const retryWithSubdomain = (newSubdomain) => {
    setFormData(prev => ({ ...prev, subdomain: newSubdomain }));
    setConflict(null);
    // Auto-submit después de cambiar subdomain
    setTimeout(() => {
      document.getElementById('submit-btn')?.click();
    }, 500);
  };

  const handleAutoGenerate = () => {
    setFormData(prev => ({ ...prev, subdomain: '' })); // Vacío = auto-generar
    setConflict(null);
    setTimeout(() => {
      document.getElementById('submit-btn')?.click();
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Registrar Nueva Empresa</h1>

      {/* Mensaje de Conflicto */}
      {conflict && (
        <div id="conflict-message" className="mb-6">
          {conflict.conflict_type === 'account_exists' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Ya tienes una cuenta
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                El email <strong>{conflict.details.email}</strong> ya está registrado.
              </p>
              <div className="space-y-2">
                {conflict.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (suggestion.action === 'login') {
                        navigate(suggestion.url);
                      } else {
                        setConflict(null);
                        // Focus en campo de email
                        document.getElementById('admin_email')?.focus();
                      }
                    }}
                    className="w-full btn btn-primary"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conflict.conflict_type === 'incomplete_registration' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                ⚠️ Registro Incompleto
              </h3>
              <p className="text-sm text-yellow-800 mb-4">
                {conflict.error}
              </p>
              <button
                onClick={handleCompleteRegistration}
                disabled={loading}
                className="w-full btn btn-warning"
              >
                {loading ? 'Completando...' : '✅ Completar Registro Ahora'}
              </button>
            </div>
          )}

          {conflict.conflict_type === 'subdomain_taken' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">
                Subdominio No Disponible
              </h3>
              <p className="text-sm text-orange-800 mb-4">
                {conflict.error}
              </p>
              <div className="space-y-2 mb-4">
                {conflict.details.suggested_alternatives.map((alt, index) => (
                  <button
                    key={index}
                    onClick={() => retryWithSubdomain(alt)}
                    className="w-full text-left px-4 py-2 bg-white border border-orange-300 rounded hover:bg-orange-50"
                  >
                    🔗 {alt}.tudominio.com
                  </button>
                ))}
              </div>
              <button
                onClick={handleAutoGenerate}
                className="w-full btn btn-primary"
              >
                🎲 Generar Subdominio Único
              </button>
            </div>
          )}
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Campos del formulario aquí */}

        <button
          id="submit-btn"
          type="submit"
          disabled={isSubmitting || loading}
          className="w-full btn btn-primary disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="spinner"></span> Registrando...
            </>
          ) : (
            'Registrar Empresa'
          )}
        </button>
      </form>
    </div>
  );
}
```

---

## 🎨 Estilos CSS Recomendados

```css
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 🔐 Prevención de Doble-Click

**Importante:** El estado `isSubmitting` previene múltiples envíos simultáneos que pueden causar conflictos.

```jsx
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();

  // ⛔ Prevenir doble-click
  if (isSubmitting) {
    console.log('Ya hay un registro en proceso...');
    return;
  }

  setIsSubmitting(true);

  try {
    // ... lógica de registro
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## 📊 Testing

### Test Manual en Producción

1. **Test Account Exists:**
   ```bash
   # Registrar primera vez
   POST /api/auth/register-tenant
   { "admin_email": "test@example.com", ... }

   # Intentar registrar de nuevo
   POST /api/auth/register-tenant
   { "admin_email": "test@example.com", ... }
   # → Debe retornar conflict_type: "account_exists"
   ```

2. **Test Incomplete Registration:**
   ```sql
   -- Crear tenant sin usuario admin en BD
   INSERT INTO tenants (name, subdomain, email)
   VALUES ('Test Hotel', 'testhotel123', 'info@test.com');

   -- Intentar registrar con ese subdomain
   POST /api/auth/register-tenant
   { "subdomain": "testhotel123", ... }
   # → Debe retornar conflict_type: "incomplete_registration"

   -- Completar registro
   POST /api/auth/register-tenant
   { "subdomain": "testhotel123", "force_complete": true, ... }
   # → Debe crear el usuario y completar
   ```

3. **Test Subdomain Taken:**
   ```bash
   # Registrar con subdomain específico
   POST /api/auth/register-tenant
   { "subdomain": "myhotel", ... }

   # Intentar con mismo subdomain pero email diferente
   POST /api/auth/register-tenant
   { "subdomain": "myhotel", "admin_email": "otro@example.com", ... }
   # → Debe retornar conflict_type: "subdomain_taken"
   ```

---

## 📝 Notas Adicionales

- **Mensajes en Español:** Todos los mensajes de error están en español para mejor UX
- **Sugerencias Contextuales:** Cada escenario incluye acciones específicas
- **Auto-completado:** El sistema puede completar registros abandonados automáticamente
- **Prevención de Colisiones:** El generador de subdomain usa timestamp + random para evitar conflictos

---

## 🚀 Próximos Pasos

1. Implementar el componente en el frontend
2. Agregar tests automatizados
3. Monitorear logs para detectar patrones de conflictos
4. Agregar métricas de tasa de recuperación exitosa

---

**Última actualización:** 2026-02-08
