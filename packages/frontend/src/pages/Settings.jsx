import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Settings as SettingsIcon, Key, Building } from 'lucide-react';

export default function Settings() {
  const { user } = useSelector((state) => state.auth);

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
