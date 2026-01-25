import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Settings as SettingsIcon, Key, Building, Sparkles, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function Settings() {
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [tenantData, setTenantData] = useState({
    stay_over_interval: 3,
    deep_cleaning_interval: 30,
    timezone: 'America/Bogota'
  });

  useEffect(() => {
    fetchTenantSettings();
  }, []);

  const fetchTenantSettings = async () => {
    try {
      const response = await api.get('/tenants/settings');
      setTenantData(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/tenants/settings', tenantData);
      toast.success('Configuración guardada correctamente');
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración</h1>
        <p className="text-gray-600">Ajustes del sistema</p>
      </div>

      {/* Tenant Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building size={24} className="text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Información del Hotel</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Nombre</label>
            <p className="font-medium text-gray-900">{user?.tenant?.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-600">Subdominio</label>
            <p className="font-medium text-gray-900">{user?.tenant?.subdomain}</p>
          </div>
        </div>
      </div>

      {/* Cleaning Intervals */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles size={24} className="text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Intervalos de Limpieza</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Configura cada cuántos días se deben realizar los diferentes tipos de aseo durante las estadías.
        </p>

        <div className="space-y-6">
          {/* Stay Over Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aseo Liviano (días)
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={tenantData.stay_over_interval}
              onChange={(e) => setTenantData({...tenantData, stay_over_interval: parseInt(e.target.value)})}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cambio de sábanas, toallas, reposición de amenidades, etc. (Por defecto: 3 días)
            </p>
          </div>

          {/* Deep Cleaning Interval */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aseo Profundo (días)
            </label>
            <input
              type="number"
              min="7"
              max="90"
              value={tenantData.deep_cleaning_interval}
              onChange={(e) => setTenantData({...tenantData, deep_cleaning_interval: parseInt(e.target.value)})}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limpieza detallada y profunda de toda la propiedad. (Por defecto: 30 días)
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zona Horaria
            </label>
            <select
              value={tenantData.timezone}
              onChange={(e) => setTenantData({...tenantData, timezone: e.target.value})}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="America/Bogota">Colombia (UTC-5)</option>
              <option value="America/New_York">New York (UTC-5/4)</option>
              <option value="America/Los_Angeles">Los Angeles (UTC-8/7)</option>
              <option value="America/Chicago">Chicago (UTC-6/5)</option>
              <option value="America/Denver">Denver (UTC-7/6)</option>
              <option value="America/Mexico_City">Ciudad de México (UTC-6/5)</option>
              <option value="America/Lima">Lima (UTC-5)</option>
              <option value="America/Buenos_Aires">Buenos Aires (UTC-3)</option>
              <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
              <option value="Europe/Madrid">Madrid (UTC+1/2)</option>
              <option value="Europe/London">London (UTC+0/1)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Configura la zona horaria para mostrar las horas correctamente en todo el sistema
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      </div>

      {/* API Token */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key size={24} className="text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Token API</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Usa este token para integrar el sistema con aplicaciones externas vía API REST.
        </p>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Tu Token API:</p>
          <p className="font-mono text-sm text-gray-900 break-all">
            Solicitar a un administrador
          </p>
        </div>
      </div>
    </div>
  );
}
