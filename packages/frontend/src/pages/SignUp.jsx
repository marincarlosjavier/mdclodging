import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { registerTenant } from '../store/slices/authSlice';
import { toast } from 'react-toastify';
import { Hotel, ArrowLeft, AlertCircle, CheckCircle, RefreshCw, Key, Mail, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function SignUp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevent double-click
  const [conflict, setConflict] = useState(null);
  const conflictMessageRef = useRef(null);

  const [formData, setFormData] = useState({
    tenantName: '',
    adminEmail: '',
    adminFullName: '',
    adminPassword: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e, options = {}) => {
    e.preventDefault();

    // Prevent double-click
    if (isSubmitting) {
      console.log('Ya hay un registro en proceso...');
      return;
    }

    // Validate passwords match
    if (formData.adminPassword !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`])[A-Za-z\d@$!%*?&#^()_\-+=\[\]{}|:;,.<>\/~`]{8,}$/;
    if (!passwordRegex.test(formData.adminPassword)) {
      toast.error('La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // Call API directly to get full error details (409 responses)
      const response = await api.post('/auth/register-tenant', {
        tenant_name: formData.tenantName,
        tenant_email: formData.adminEmail,
        admin_name: formData.adminFullName,
        admin_email: formData.adminEmail,
        admin_password: formData.adminPassword,
        ...options // Includes force_complete flag if provided
      });

      // Success - store auth data
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      if (response.data.completed_incomplete_registration) {
        toast.success('✅ Registro completado exitosamente!');
      } else {
        toast.success('¡Empresa registrada exitosamente! Bienvenido');
      }

      navigate('/dashboard');

    } catch (error) {
      if (error.response?.status === 409) {
        // Conflict detected - show contextual UI
        const conflictData = error.response.data;
        setConflict(conflictData);

        // Scroll to conflict message
        setTimeout(() => {
          conflictMessageRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 100);

        // Show toast for quick feedback
        toast.warning(conflictData.error || 'Conflicto detectado');

      } else {
        // Other errors
        toast.error(error.response?.data?.error || 'Error al registrar empresa');
      }
    } finally {
      setLoading(false);
      // Re-enable after a safety timeout
      setTimeout(() => setIsSubmitting(false), 2000);
    }
  };

  const handleCompleteRegistration = () => {
    // Retry with force_complete flag
    const fakeEvent = { preventDefault: () => {} };
    handleSubmit(fakeEvent, { force_complete: true });
  };

  const retryWithSubdomain = (newSubdomain) => {
    setConflict(null);
    // Note: Current form doesn't have subdomain field, so we auto-generate
    toast.info(`Generando con subdominio: ${newSubdomain}`);
    setTimeout(() => {
      document.getElementById('submit-btn')?.click();
    }, 500);
  };

  const handleAutoGenerate = () => {
    setConflict(null);
    toast.info('Generando subdominio único automáticamente...');
    setTimeout(() => {
      document.getElementById('submit-btn')?.click();
    }, 500);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear conflict when user starts typing
    if (conflict && (name === 'adminEmail' || name === 'tenantName')) {
      setConflict(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-primary-100 p-4 rounded-full">
              <Hotel size={40} className="text-primary-600" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Crear Nueva Empresa
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Registra tu empresa y crea tu cuenta de superadministrador
          </p>

          {/* Conflict Message */}
          {conflict && (
            <div ref={conflictMessageRef} className="mb-6">
              {/* Account Exists */}
              {conflict.conflict_type === 'account_exists' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">
                        Ya tienes una cuenta
                      </h3>
                      <p className="text-sm text-blue-800">
                        El email <strong>{conflict.details?.email}</strong> ya está registrado para{' '}
                        <strong>{conflict.details?.tenant_name}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {conflict.suggestions?.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          if (suggestion.action === 'login') {
                            navigate(suggestion.url);
                          } else if (suggestion.action === 'use_different_email') {
                            setConflict(null);
                            document.getElementById('adminEmail')?.focus();
                          }
                        }}
                        className={`w-full px-4 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                          suggestion.action === 'login'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-white border-2 border-blue-300 text-blue-700 hover:bg-blue-50'
                        }`}
                      >
                        {suggestion.action === 'login' ? <Key size={18} /> : <Mail size={18} />}
                        {suggestion.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Incomplete Registration */}
              {conflict.conflict_type === 'incomplete_registration' && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                        ⚠️ Registro Incompleto Detectado
                      </h3>
                      <p className="text-sm text-yellow-800">
                        Encontramos que iniciaste el registro de <strong>{conflict.details?.tenant_name}</strong> pero
                        no se completó. ¿Quieres continuar donde lo dejaste?
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCompleteRegistration}
                    disabled={loading}
                    className="w-full bg-yellow-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-yellow-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle size={18} />
                    {loading ? 'Completando...' : '✅ Completar Registro Ahora'}
                  </button>
                </div>
              )}

              {/* Subdomain Taken */}
              {conflict.conflict_type === 'subdomain_taken' && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertCircle className="text-orange-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                      <h3 className="text-lg font-semibold text-orange-900 mb-2">
                        Subdominio No Disponible
                      </h3>
                      <p className="text-sm text-orange-800 mb-4">
                        {conflict.error}
                      </p>
                      {conflict.details?.suggested_alternatives && conflict.details.suggested_alternatives.length > 0 && (
                        <>
                          <p className="text-sm text-orange-800 font-medium mb-3">
                            Te sugerimos estas alternativas:
                          </p>
                          <div className="space-y-2 mb-4">
                            {conflict.details.suggested_alternatives.map((alt, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => retryWithSubdomain(alt)}
                                className="w-full text-left px-4 py-2 bg-white border-2 border-orange-300 rounded-lg hover:bg-orange-50 transition flex items-center gap-2"
                              >
                                <ExternalLink size={16} className="text-orange-600" />
                                <span className="text-orange-900 font-medium">{alt}.tudominio.com</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={loading}
                    className="w-full bg-orange-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-orange-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={18} />
                    🎲 Generar Subdominio Único Automáticamente
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tenant Information */}
            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de la Empresa</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la Empresa *
                </label>
                <input
                  type="text"
                  name="tenantName"
                  value={formData.tenantName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  placeholder="Ej: Hotel Paradise"
                />
              </div>
            </div>

            {/* Admin Information */}
            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del Superadministrador</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  name="adminFullName"
                  value={formData.adminFullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  id="adminEmail"
                  type="email"
                  name="adminEmail"
                  value={formData.adminEmail}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  placeholder="admin@tuempresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña *
                </label>
                <input
                  type="password"
                  name="adminPassword"
                  value={formData.adminPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  placeholder="Mínimo 8 caracteres"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Debe incluir mayúsculas, minúsculas, números y caracteres especiales
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
                  placeholder="Repite tu contraseña"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando cuenta...' : 'Crear Empresa y Cuenta'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 transition"
            >
              <ArrowLeft size={16} />
              <span>Volver al inicio de sesión</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
