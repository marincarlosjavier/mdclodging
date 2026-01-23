import { useEffect, useState } from 'react';
import { telegramAPI } from '../services/api';
import { toast } from 'react-toastify';
import { Shield, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

export default function TelegramPermissions() {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissions: {}
  });
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await telegramAPI.getPermissionsCatalog(true);
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      permissions: {}
    });
    setEditingPermission(null);
    setShowCreateModal(true);
    setJsonError('');
  };

  const handleEdit = (permission) => {
    setFormData({
      code: permission.code,
      name: permission.name,
      description: permission.description,
      permissions: permission.permissions
    });
    setEditingPermission(permission);
    setShowCreateModal(true);
    setJsonError('');
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    try {
      if (editingPermission) {
        await telegramAPI.updatePermission(editingPermission.id, formData);
        toast.success('Permiso actualizado exitosamente');
      } else {
        await telegramAPI.createPermission(formData);
        toast.success('Permiso creado exitosamente');
      }
      setShowCreateModal(false);
      fetchPermissions();
    } catch (error) {
      // Error already handled
    }
  };

  const handleToggleActive = async (permission) => {
    try {
      await telegramAPI.updatePermission(permission.id, {
        is_active: !permission.is_active
      });
      toast.success(`Permiso ${permission.is_active ? 'desactivado' : 'activado'}`);
      fetchPermissions();
    } catch (error) {
      // Error already handled
    }
  };

  const handleDelete = async (permission) => {
    if (!confirm(`¿Estás seguro de eliminar el permiso "${permission.name}"?`)) {
      return;
    }

    try {
      const response = await telegramAPI.deletePermission(permission.id);
      if (response.data.soft_delete) {
        toast.info('Permiso desactivado (está en uso)');
      } else {
        toast.success('Permiso eliminado exitosamente');
      }
      fetchPermissions();
    } catch (error) {
      // Error already handled
    }
  };

  const handlePermissionsJsonChange = (value) => {
    try {
      const parsed = JSON.parse(value);
      setFormData({ ...formData, permissions: parsed });
      setJsonError('');
    } catch (error) {
      setJsonError('JSON inválido');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Permisos de Telegram</h1>
          <p className="text-gray-600">Gestiona el catálogo de permisos reutilizables</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
        >
          <Plus size={20} />
          Nuevo Permiso
        </button>
      </div>

      {/* Permissions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {permissions.length === 0 ? (
          <div className="text-center py-12">
            <Shield size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No hay permisos configurados</p>
            <p className="text-sm text-gray-400">Crea el primer permiso para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacidades
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr key={permission.id} className={`hover:bg-gray-50 ${!permission.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {permission.code}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{permission.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{permission.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(permission.permissions || {}).length > 0 ? (
                          Object.entries(permission.permissions).map(([key, value]) => (
                            value && (
                              <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {key}
                              </span>
                            )
                          ))
                        ) : (
                          <span className="text-xs text-gray-400">Sin capacidades</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(permission)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition ${
                          permission.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {permission.is_active ? '✓ Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(permission)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(permission)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingPermission ? 'Editar Permiso' : 'Nuevo Permiso'}
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="admin, housekeeping, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={editingPermission !== null}
                />
                {editingPermission && (
                  <p className="text-xs text-gray-500 mt-1">El código no se puede modificar</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Admin Telegram, Housekeeping, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe qué puede hacer este permiso..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              {/* Permissions JSON */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacidades (JSON)
                </label>
                <textarea
                  defaultValue={JSON.stringify(formData.permissions, null, 2)}
                  onChange={(e) => handlePermissionsJsonChange(e.target.value)}
                  placeholder='{"can_view_tasks": true, "can_update_tasks": true}'
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-none"
                />
                {jsonError && (
                  <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                    <AlertCircle size={16} />
                    {jsonError}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Define las capacidades específicas como propiedades booleanas
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={!formData.code || !formData.name || jsonError}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {editingPermission ? 'Actualizar' : 'Crear'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
