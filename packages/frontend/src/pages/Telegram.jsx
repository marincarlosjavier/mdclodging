import { useEffect, useState } from 'react';
import { telegramAPI, usersAPI } from '../services/api';
import { toast } from 'react-toastify';
import { MessageCircle, Link as LinkIcon, User, Power, Settings as SettingsIcon } from 'lucide-react';

export default function Telegram() {
  const [botStatus, setBotStatus] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [linkCodes, setLinkCodes] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [generatedCode, setGeneratedCode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleStartBot = async () => {
    try {
      await telegramAPI.start();
      toast.success('Bot iniciado correctamente');
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleStopBot = async () => {
    try {
      await telegramAPI.stop();
      toast.success('Bot detenido');
      fetchData();
    } catch (error) {
      // Error already handled
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedUser) {
      toast.error('Selecciona un usuario');
      return;
    }

    try {
      const response = await telegramAPI.generateLinkCode(selectedUser);
      setGeneratedCode(response.data);
      toast.success('Código generado correctamente');
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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración de Telegram</h1>
        <p className="text-gray-600">Gestiona el bot de Telegram y vinculaciones</p>
      </div>

      {/* Bot Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${botStatus?.running ? 'bg-green-100' : 'bg-red-100'}`}>
              <MessageCircle size={24} className={botStatus?.running ? 'text-green-600' : 'text-red-600'} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Estado del Bot</h3>
              <p className="text-sm text-gray-600">
                {botStatus?.running ? '🟢 Activo' : '🔴 Inactivo'}
                {botStatus?.username && ` • @${botStatus.username}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {botStatus?.running ? (
              <button
                onClick={handleStopBot}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <Power size={18} />
              </button>
            ) : (
              <button
                onClick={handleStartBot}
                disabled={!botStatus?.has_token}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                Iniciar Bot
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Generate Link Code */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <LinkIcon size={20} />
          Generar Código de Vinculación
        </h3>
        <div className="flex gap-4">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Selecciona un usuario...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({user.email}) - {user.role}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateCode}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Generar Código
          </button>
        </div>

        {generatedCode && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-gray-600 mb-2">Código generado para {generatedCode.user.full_name}:</p>
            <p className="text-3xl font-bold text-green-600 mb-2">{generatedCode.code}</p>
            <p className="text-xs text-gray-500">
              Válido hasta: {new Date(generatedCode.expires_at).toLocaleString('es-ES')}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              El usuario debe enviar este código al bot de Telegram para vincular su cuenta.
            </p>
          </div>
        )}
      </div>

      {/* Active Link Codes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Códigos Activos</h3>
        {linkCodes.length === 0 ? (
          <p className="text-gray-600 text-sm">No hay códigos activos</p>
        ) : (
          <div className="space-y-2">
            {linkCodes.map((code) => (
              <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{code.code}</p>
                  <p className="text-sm text-gray-600">{code.full_name} • {code.email}</p>
                </div>
                <p className="text-xs text-gray-500">
                  Expira: {new Date(code.expires_at).toLocaleDateString('es-ES')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Contacts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contactos Vinculados</h3>
        {contacts.length === 0 ? (
          <p className="text-gray-600 text-sm">No hay contactos vinculados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telegram</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vinculado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {contacts.filter(c => c.user_id).map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{contact.full_name}</div>
                      <div className="text-sm text-gray-600">{contact.email}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      @{contact.username || contact.first_name}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(contact.linked_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contact.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contact.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
