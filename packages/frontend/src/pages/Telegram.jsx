import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { telegramAPI, usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { MessageCircle, Link as LinkIcon, User, Power, Pause, Trash2, RefreshCw, Edit2, Check, X, Shield, Plus, AlertCircle } from 'lucide-react';

export default function Telegram() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname.includes('/permissions') ? 'permissions' : 'connections');
  const [botStatus, setBotStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [linkCodes, setLinkCodes] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [botToken, setBotToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [pausingBot, setPausingBot] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // { contactId, userId, currentRoles, fullName }
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [editingPermissions, setEditingPermissions] = useState(null); // { contactId, currentPermissions, fullName }
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Permissions Catalog state
  const [catalogPermissions, setCatalogPermissions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingCatalogPermission, setEditingCatalogPermission] = useState(null);
  const [showCreateCatalogModal, setShowCreateCatalogModal] = useState(false);
  const [catalogFormData, setCatalogFormData] = useState({
    code: '',
    name: '',
    description: '',
    permissions: {}
  });
  const [jsonError, setJsonError] = useState('');

  useEffect(() => {
    fetchData();
    fetchPermissionsCatalog();
    if (activeTab === 'permissions') {
      fetchCatalogPermissions();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'permissions') {
      fetchCatalogPermissions();
      navigate('/telegram/permissions', { replace: true });
    } else {
      navigate('/telegram', { replace: true });
    }
  }, [activeTab]);

  const fetchPermissionsCatalog = async () => {
    try {
      const response = await telegramAPI.getPermissionsCatalog();
      setPermissionsCatalog(response.data);
    } catch (error) {
      console.error('Error fetching permissions catalog:', error);
    }
  };

  const fetchCatalogPermissions = async () => {
    setCatalogLoading(true);
    try {
      const response = await telegramAPI.getPermissionsCatalog(true);
      setCatalogPermissions(response.data);
    } catch (error) {
      console.error('Error fetching catalog permissions:', error);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleCreateCatalogPermission = () => {
    setCatalogFormData({
      code: '',
      name: '',
      description: '',
      permissions: {}
    });
    setEditingCatalogPermission(null);
    setShowCreateCatalogModal(true);
    setJsonError('');
  };

  const handleEditCatalogPermission = (permission) => {
    setCatalogFormData({
      code: permission.code,
      name: permission.name,
      description: permission.description,
      permissions: permission.permissions
    });
    setEditingCatalogPermission(permission);
    setShowCreateCatalogModal(true);
    setJsonError('');
  };

  const handleSaveCatalogPermission = async () => {
    if (!catalogFormData.code || !catalogFormData.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    try {
      if (editingCatalogPermission) {
        await telegramAPI.updatePermission(editingCatalogPermission.id, catalogFormData);
        toast.success('Permiso actualizado exitosamente');
      } else {
        await telegramAPI.createPermission(catalogFormData);
        toast.success('Permiso creado exitosamente');
      }
      setShowCreateCatalogModal(false);
      fetchCatalogPermissions();
      fetchPermissionsCatalog();
    } catch (error) {
      // Error already handled
    }
  };

  const handleToggleCatalogActive = async (permission) => {
    try {
      await telegramAPI.updatePermission(permission.id, {
        is_active: !permission.is_active
      });
      toast.success(`Permiso ${permission.is_active ? 'desactivado' : 'activado'}`);
      fetchCatalogPermissions();
      fetchPermissionsCatalog();
    } catch (error) {
      // Error already handled
    }
  };

  const handleDeleteCatalogPermission = async (permission) => {
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
      fetchCatalogPermissions();
      fetchPermissionsCatalog();
    } catch (error) {
      // Error already handled
    }
  };

  const handlePermissionsJsonChange = (value) => {
    try {
      const parsed = JSON.parse(value);
      setCatalogFormData({ ...catalogFormData, permissions: parsed });
      setJsonError('');
    } catch (error) {
      setJsonError('JSON inválido');
    }
  };

  const fetchData = async () => {
    try {
      const [statusRes, contactsRes, codesRes, usersRes] = await Promise.all([
        telegramAPI.getStatus(),
        telegramAPI.getContacts(),
        telegramAPI.getLinkCodes(),
        usersAPI.getAll({ is_active: true })
      ]);

      setBotStatus(statusRes.data);
      setContacts(contactsRes.data);
      setLinkCodes(codesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = () => {
    if (!selectedUser) {
      toast.error('Selecciona un usuario');
      return;
    }

    // Show permission selection modal
    setSelectedPermissions([]);
    setShowPermissionModal(true);
  };

  const handleConfirmGenerateCode = async () => {
    if (selectedPermissions.length === 0) {
      toast.error('Debes seleccionar al menos un permiso');
      return;
    }

    try {
      const response = await telegramAPI.generateLinkCode(selectedUser, selectedPermissions);
      const code = response.data;

      // Show modal with generated code
      setGeneratedCode(code);
      setSelectedUser('');
      setSelectedPermissions([]);
      setShowPermissionModal(false);
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleConnectBot = async () => {
    if (!botToken.trim()) {
      toast.error('El token del bot es requerido');
      return;
    }

    setConnecting(true);
    setConnectionError(null);

    try {
      // Configure and start bot in one step
      await telegramAPI.configure({
        bot_token: botToken.trim(),
        enabled: true
      });

      // Try to start the bot
      await telegramAPI.start();

      toast.success('🎉 Bot conectado exitosamente!');
      setBotToken('');
      fetchData();
    } catch (error) {
      setConnectionError(error.response?.data?.error || error.message || 'Error al conectar el bot');
    } finally {
      setConnecting(false);
    }
  };

  const handlePauseBot = async () => {
    setPausingBot(true);
    try {
      await telegramAPI.stop();
      toast.success('Bot pausado temporalmente');
      fetchData();
    } catch (error) {
      // Error already handled
    } finally {
      setPausingBot(false);
    }
  };

  const handleResumeBot = async () => {
    try {
      await telegramAPI.start();
      toast.success('Bot reanudado');
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleDisconnectBot = async () => {
    try {
      await telegramAPI.stop();
      await telegramAPI.configure({
        bot_token: '',
        enabled: false
      });
      toast.success('Bot desconectado completamente');
      setShowDisconnectConfirm(false);
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleToggleContactStatus = async (contactId, currentStatus) => {
    try {
      if (!currentStatus) {
        // Activar contacto
        await telegramAPI.activateContact(contactId);
        toast.success('Usuario activado');
      } else {
        // Desactivar contacto
        await telegramAPI.deactivateContact(contactId);
        toast.success('Usuario desactivado');
      }
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await telegramAPI.unlinkContact(contactId);
      toast.success('Usuario eliminado');
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleRegenerateCode = async (userId) => {
    try {
      await telegramAPI.generateLinkCode(userId);
      toast.success('Código regenerado');
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleEditRole = (contactId, userId, currentRoles, fullName, isPending = false) => {
    setEditingRole({ contactId, userId, currentRoles, fullName, isPending });
    setSelectedRoles(Array.isArray(currentRoles) ? currentRoles : [currentRoles]);
  };

  const handleToggleRole = (role) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        // Don't allow removing the last role
        if (prev.length === 1) {
          toast.error('El usuario debe tener al menos un rol');
          return prev;
        }
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSaveRole = async () => {
    if (!editingRole || selectedRoles.length === 0) {
      toast.error('Selecciona al menos un rol');
      return;
    }

    try {
      // Use different endpoint depending on whether user is linked or pending
      if (editingRole.isPending || !editingRole.contactId) {
        await telegramAPI.updateUserRole(editingRole.userId, selectedRoles);
      } else {
        await telegramAPI.updateContactRole(editingRole.contactId, selectedRoles);
      }
      toast.success('Roles actualizados exitosamente');
      setEditingRole(null);
      setSelectedRoles([]);
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleEditPermissions = (contactId, currentPermissions, fullName) => {
    setEditingPermissions({ contactId, currentPermissions, fullName });
    // Extract permission IDs from current permissions
    const permissionIds = (currentPermissions || []).map(p => p.id);
    setSelectedPermissions(permissionIds);
  };

  const handleTogglePermission = (permissionId) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(p => p !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions) return;

    try {
      await telegramAPI.updateContactPermissions(editingPermissions.contactId, selectedPermissions);
      toast.success('Permisos actualizados exitosamente');
      setEditingPermissions(null);
      setSelectedPermissions([]);
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show setup view only if no token configured
  if (!botStatus?.has_token) {
    return (
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración de Telegram</h1>
          <p className="text-gray-600">Conecta tu bot de Telegram para gestionar notificaciones y tareas</p>
        </div>

        {/* Setup Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <MessageCircle size={32} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Conectar Bot de Telegram</h2>
            <p className="text-gray-600">Sigue estos pasos para conectar tu bot</p>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">
              📝 Cómo crear un bot de Telegram:
            </p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Abre Telegram y busca <strong>@BotFather</strong></li>
              <li>Envía el comando <strong>/newbot</strong></li>
              <li>Sigue las instrucciones para nombrar tu bot</li>
              <li>Copia el <strong>token</strong> que te proporciona BotFather</li>
              <li>Pega el token abajo y haz clic en "Conectar"</li>
            </ol>
          </div>

          {/* Token Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token del Bot <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={connecting}
              />
            </div>

            {/* Error Message */}
            {connectionError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium mb-1">
                  ❌ Error al conectar
                </p>
                <p className="text-sm text-red-700">{connectionError}</p>
                <p className="text-xs text-red-600 mt-2">
                  💡 <strong>Sugerencia:</strong> Verifica que el token sea correcto y esté activo en @BotFather
                </p>
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={handleConnectBot}
              disabled={connecting || !botToken.trim()}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {connecting ? 'Conectando...' : 'Conectar Bot'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected view - show management interface
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Telegram</h1>
            <p className="text-gray-600">Gestiona el bot y los permisos de Telegram</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'connections' && (
              <>
                {botStatus?.running ? (
                  <button
                    onClick={handlePauseBot}
                    disabled={pausingBot}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Pause size={18} />
                    {pausingBot ? 'Pausando...' : 'Pausar Bot'}
                  </button>
                ) : (
                  <button
                    onClick={handleResumeBot}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <Power size={18} />
                    Reanudar Bot
                  </button>
                )}
                <button
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                >
                  <Power size={18} />
                  Desconectar
                </button>
              </>
            )}
            {activeTab === 'permissions' && (
              <button
                onClick={handleCreateCatalogPermission}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <Plus size={20} />
                Nuevo Permiso
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('connections')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'connections'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <User size={18} />
                Vinculaciones
              </div>
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'permissions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield size={18} />
                Catálogo de Permisos
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Desconectar bot completamente?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Esto eliminará el token y toda la configuración del bot. Deberás volver a configurar el bot desde cero.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDisconnectBot}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Sí, desconectar
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Code Modal */}
      {generatedCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <LinkIcon size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Código Generado</h3>
              <p className="text-sm text-gray-600 mb-4">
                Para: <strong>{generatedCode.user.full_name}</strong>
              </p>

              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-4">
                <p className="text-4xl font-bold text-blue-600 tracking-wider font-mono">
                  {generatedCode.code}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  📱 Instrucciones para el usuario:
                </p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Abre Telegram</li>
                  <li>Busca el bot: <strong>@{botStatus?.username || 'el_bot'}</strong></li>
                  <li>Envía el comando: <strong>/start</strong></li>
                  <li>Envía este código cuando te lo pida</li>
                </ol>
              </div>

              <button
                onClick={() => setGeneratedCode(null)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal (System Roles) */}
      {editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Editar Rol del Sistema</h3>
            <p className="text-xs text-gray-500 mb-4">
              Control de acceso a la aplicación web
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Usuario: <strong>{editingRole.fullName}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona los roles (puedes elegir múltiples)
              </label>
              <div className="space-y-3">
                {[
                  { value: 'admin', label: 'Admin', desc: 'Acceso completo al sistema' },
                  { value: 'supervisor', label: 'Supervisor', desc: 'Gestionar tareas y usuarios' },
                  { value: 'housekeeping', label: 'Housekeeping', desc: 'Tareas de limpieza' },
                  { value: 'maintenance', label: 'Maintenance', desc: 'Tareas de mantenimiento' }
                ].map(role => (
                  <label
                    key={role.value}
                    className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                      selectedRoles.includes(role.value)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.value)}
                      onChange={() => handleToggleRole(role.value)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{role.label}</div>
                      <div className="text-xs text-gray-500">{role.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveRole}
                disabled={selectedRoles.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setEditingRole(null);
                  setSelectedRoles([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal (Telegram Permissions from Catalog) */}
      {editingPermissions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Editar Permisos de Telegram</h3>
            <p className="text-xs text-gray-500 mb-4">
              Control de acceso al bot de Telegram
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Usuario: <strong>{editingPermissions.fullName}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona los permisos (puedes elegir múltiples)
              </label>
              <div className="space-y-3">
                {permissionsCatalog.map(permission => (
                  <label
                    key={permission.id}
                    className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                      selectedPermissions.includes(permission.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission.id)}
                      onChange={() => handleTogglePermission(permission.id)}
                      className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{permission.name}</div>
                      <div className="text-xs text-gray-500">{permission.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSavePermissions}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Guardar
              </button>
              <button
                onClick={() => {
                  setEditingPermissions(null);
                  setSelectedPermissions([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Connections */}
      {activeTab === 'connections' && (
        <>
          {/* Bot Info Banner */}
          <div className={`border rounded-lg p-4 mb-6 ${
            botStatus?.running
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              botStatus?.running ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {botStatus?.running ? (
                <MessageCircle size={20} className="text-green-600" />
              ) : (
                <Pause size={20} className="text-yellow-600" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              botStatus?.running ? 'text-green-900' : 'text-yellow-900'
            }`}>
              {botStatus?.running ? 'Bot activo' : 'Bot pausado'} {botStatus?.username && `• @${botStatus.username}`}
            </p>
            <p className={`text-xs mt-0.5 ${
              botStatus?.running ? 'text-green-700' : 'text-yellow-700'
            }`}>
              {botStatus?.running
                ? 'Genera códigos de vinculación para que los usuarios conecten sus cuentas de Telegram'
                : 'El bot está pausado. Los usuarios no recibirán notificaciones. Haz clic en "Reanudar Bot" para activarlo.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Users & Connections Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User size={20} />
            Usuarios Conectados
          </h3>

          {/* Generate Code Inline */}
          <div className="flex gap-3">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">Agregar usuario...</option>
              {users.filter(u => {
                // Exclude users already linked
                const isLinked = contacts.find(c => c.user_id === u.id);
                // Exclude users with active link codes
                const hasActiveCode = linkCodes.find(lc => lc.user_id === u.id);
                return !isLinked && !hasActiveCode;
              }).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role})
                </option>
              ))}
            </select>
            <button
              onClick={handleGenerateCode}
              disabled={!selectedUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <LinkIcon size={16} />
              Generar Código
            </button>
          </div>
        </div>

        {/* Users Table */}
        {contacts.length === 0 && linkCodes.length === 0 ? (
          <div className="text-center py-12">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No hay usuarios conectados</p>
            <p className="text-sm text-gray-400">Genera un código para vincular el primer usuario</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conectado desde
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permisos Telegram
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Show linked contacts */}
                {contacts.filter(c => c.user_id).map((contact) => {
                  const linkCode = linkCodes.find(lc => lc.user_id === contact.user_id);

                  return (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium text-gray-900">{contact.full_name}</div>
                            <div className="text-sm text-gray-500">
                              @{contact.username || contact.first_name} • {contact.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {linkCode ? (
                          <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {linkCode.code}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Vinculado</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {new Date(contact.linked_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex gap-1 flex-wrap">
                            {(contact.telegram_permissions || []).length > 0 ? (
                              (contact.telegram_permissions || []).map(p => (
                                <span key={p.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {p.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">Sin permisos</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleEditPermissions(contact.id, contact.telegram_permissions, contact.full_name)}
                            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition flex-shrink-0"
                            title="Editar permisos"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleToggleContactStatus(contact.id, contact.is_active)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition ${
                            contact.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {contact.is_active ? '✓ Activo' : '○ Inactivo'}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRegenerateCode(contact.user_id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Regenerar código"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            disabled={contact.is_active}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title={contact.is_active ? 'Desactiva el usuario primero' : 'Eliminar usuario'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Show pending codes (users with codes but not yet linked) */}
                {linkCodes.filter(lc => !contacts.find(c => c.user_id === lc.user_id)).map((linkCode) => {
                  return (
                    <tr key={`pending-${linkCode.id}`} className="hover:bg-gray-50 bg-yellow-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium text-yellow-700">{linkCode.full_name}</div>
                            <div className="text-sm text-gray-500">
                              {linkCode.email} • Esperando vinculación
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-sm bg-yellow-100 px-2 py-1 rounded font-medium text-yellow-800">
                          {linkCode.code}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className="text-gray-400">-</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-gray-400">No vinculado</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pendiente
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRegenerateCode(linkCode.user_id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Regenerar código"
                          >
                            <RefreshCw size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permission Selection Modal for Code Generation */}
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Seleccionar Permisos de Telegram</h3>
            <p className="text-xs text-gray-500 mb-4">
              Estos permisos se asignarán automáticamente cuando el usuario se vincule
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Selecciona los permisos (mínimo 1)
              </label>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {permissionsCatalog
                  .filter(p => p.is_active)
                  .map(permission => (
                    <label
                      key={permission.id}
                      className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                        selectedPermissions.includes(permission.id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={() => handleTogglePermission(permission.id)}
                        className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{permission.name}</div>
                        <div className="text-xs text-gray-500">{permission.description}</div>
                      </div>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmGenerateCode}
                disabled={selectedPermissions.length === 0}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generar Código
              </button>
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setSelectedPermissions([]);
                }}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tab Content: Permissions Catalog */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {catalogLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : catalogPermissions.length === 0 ? (
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
                  {catalogPermissions.map((permission) => (
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
                          onClick={() => handleToggleCatalogActive(permission)}
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
                            onClick={() => handleEditCatalogPermission(permission)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCatalogPermission(permission)}
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
      )}

      {/* Create/Edit Catalog Permission Modal */}
      {showCreateCatalogModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingCatalogPermission ? 'Editar Permiso' : 'Nuevo Permiso'}
              </h3>
              <button
                onClick={() => setShowCreateCatalogModal(false)}
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
                  value={catalogFormData.code}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, code: e.target.value })}
                  placeholder="admin, housekeeping, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={editingCatalogPermission !== null}
                />
                {editingCatalogPermission && (
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
                  value={catalogFormData.name}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, name: e.target.value })}
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
                  value={catalogFormData.description}
                  onChange={(e) => setCatalogFormData({ ...catalogFormData, description: e.target.value })}
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
                  defaultValue={JSON.stringify(catalogFormData.permissions, null, 2)}
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
                onClick={handleSaveCatalogPermission}
                disabled={!catalogFormData.code || !catalogFormData.name || jsonError}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Check size={18} />
                {editingCatalogPermission ? 'Actualizar' : 'Crear'}
              </button>
              <button
                onClick={() => setShowCreateCatalogModal(false)}
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
