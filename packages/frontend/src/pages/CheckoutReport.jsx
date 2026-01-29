import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, XCircle, Loader, LogOut, X, Edit, Play, Timer, RefreshCw } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { updateReservation } from '../store/slices/reservationsSlice';
import { toast } from 'react-toastify';
import api from '../services/api';
import { getTodayInColombia, createColombiaDateTime, formatColombiaTime } from '../utils/timezone';

export default function CheckoutReport() {
  const dispatch = useDispatch();
  const [date, setDate] = useState(getTodayInColombia());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStartTaskModal, setShowStartTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [housekeepingUsers, setHousekeepingUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusFilters, setStatusFilters] = useState({
    waiting_checkout: true,
    checked_out: true,
    in_progress: true,
    completed: false
  });
  const [showCompleteTaskModal, setShowCompleteTaskModal] = useState(false);
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [timezone, setTimezone] = useState('America/Bogota');

  useEffect(() => {
    fetchTenantSettings();
    fetchReport();

    // Auto-refresh every 30 seconds to catch updates from Telegram
    const refreshInterval = setInterval(() => {
      fetchReport();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [date, statusFilters]);

  const fetchTenantSettings = async () => {
    try {
      const response = await api.get('/tenants/settings');
      if (response.data.timezone) {
        setTimezone(response.data.timezone);
      }
    } catch (error) {
      console.error('Error fetching tenant settings:', error);
    }
  };

  // Update current time every second for elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchReport = async () => {
    console.log('[fetchReport] Called with filters:', statusFilters);
    setLoading(true);
    try {
      // Map frontend filters to backend statuses
      const backendStatuses = [];
      if (statusFilters.waiting_checkout) {
        backendStatuses.push('pending'); // Backend: pending without actual_checkout_time
      }
      if (statusFilters.checked_out) {
        backendStatuses.push('checked_out'); // Backend: pending with actual_checkout_time
      }
      if (statusFilters.in_progress) {
        backendStatuses.push('in_progress');
      }
      if (statusFilters.completed) {
        backendStatuses.push('completed');
      }

      console.log('[fetchReport] Backend statuses:', backendStatuses);

      // If no statuses selected, fetch nothing
      if (backendStatuses.length === 0) {
        console.log('[fetchReport] No statuses selected, clearing report');
        setReport({ date, total_checkouts: 0, checkouts: [] });
        setLoading(false);
        return;
      }

      const statuses = backendStatuses.join(',');
      console.log('[fetchReport] Fetching:', `/reservations/checkout-report?date=${date}&statuses=${statuses}`);
      const response = await api.get(`/reservations/checkout-report?date=${date}&statuses=${statuses}`);
      const checkouts = Array.isArray(response.data.checkouts) ? response.data.checkouts : [];
      console.log('[fetchReport] Received', checkouts.length, 'checkouts');
      setReport({ ...response.data, checkouts });
    } catch (error) {
      console.error('Error fetching checkout report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilterChange = (status) => {
    console.log('[Checkbox Click]', status, 'current:', statusFilters[status], 'will become:', !statusFilters[status]);
    setStatusFilters(prev => {
      const newFilters = {
        ...prev,
        [status]: !prev[status]
      };
      console.log('[New Filters]', newFilters);
      return newFilters;
    });
  };

  const handleStartTask = async (checkout) => {
    try {
      // Get users who are logged in via Telegram (uses telegram_roles, not system role)
      console.log('[DEBUG] Fetching logged in users...');
      const response = await api.get('/users?logged_in=true');
      const loggedInUsers = response.data;
      console.log('[DEBUG] Logged in users response:', loggedInUsers);
      console.log('[DEBUG] Number of users:', loggedInUsers.length);

      setSelectedTask(checkout);
      setHousekeepingUsers(loggedInUsers);

      if (loggedInUsers.length === 0) {
        // No users logged in - show warning modal
        console.log('[DEBUG] No users logged in, showing warning modal');
        setSelectedUser(null);
        setShowStartTaskModal(true);
      } else if (loggedInUsers.length === 1) {
        // Only one user - assign automatically
        console.log('[DEBUG] One user found, auto-assigning to:', loggedInUsers[0].full_name);
        await startTaskWithUser(checkout.cleaning_task_id, loggedInUsers[0].id);
      } else {
        // Multiple users - show selection modal
        console.log('[DEBUG] Multiple users found, showing selection modal');
        setSelectedUser(null);
        setShowStartTaskModal(true);
      }
    } catch (error) {
      console.error('Error fetching housekeeping users:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Error al obtener usuarios de housekeeping');
    }
  };

  const startTaskWithUser = async (taskId, userId = null) => {
    try {
      await api.put(`/cleaning-tasks/${taskId}/start`, {
        assigned_to: userId
      });

      const userName = userId ? housekeepingUsers.find(u => u.id === userId)?.full_name : 'sin asignar';
      toast.success(`Tarea iniciada${userId ? ` - Asignada a ${userName}` : ' sin asignar'}`);

      setShowStartTaskModal(false);
      setSelectedTask(null);
      setSelectedUser(null);
      fetchReport();
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Error al iniciar la tarea');
    }
  };

  const handleConfirmStartTask = () => {
    if (selectedTask) {
      startTaskWithUser(selectedTask.cleaning_task_id, selectedUser);
    }
  };

  const handleCompleteTask = (checkout) => {
    setTaskToComplete(checkout);
    setShowCompleteTaskModal(true);
  };

  const confirmCompleteTask = async () => {
    if (!taskToComplete) return;

    try {
      await api.put(`/cleaning-tasks/${taskToComplete.cleaning_task_id}/complete`);
      toast.success('Tarea completada correctamente');
      setShowCompleteTaskModal(false);
      setTaskToComplete(null);
      fetchReport();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Error al completar la tarea');
    }
  };

  const calculateElapsedTime = (checkout) => {
    const { actual_checkout_time, check_out_date, started_at, completed_at } = checkout;

    // No checkout reported yet
    if (!actual_checkout_time) {
      return { time: '-', color: 'text-gray-400', label: '' };
    }

    // Checkout reported, waiting to start
    if (actual_checkout_time && !started_at) {
      // Extract date in Colombia timezone and combine with time
      const colombiaDate = new Date(check_out_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const checkoutDateTime = new Date(`${colombiaDate}T${actual_checkout_time}`);
      const elapsed = Math.floor((currentTime - checkoutDateTime) / 1000);

      // If elapsed is negative, checkout is in the future
      if (elapsed < 0) {
        return { time: '-', color: 'text-gray-400', label: '' };
      }

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      let timeStr = '';
      if (hours > 0) timeStr = `${hours}h ${minutes}m`;
      else if (minutes > 0) timeStr = `${minutes}m ${seconds}s`;
      else timeStr = `${seconds}s`;

      return { time: timeStr, color: 'text-orange-700', label: 'Esperando inicio' };
    }

    // Task started, in progress
    if (started_at && !completed_at) {
      const startTime = new Date(started_at);
      const elapsed = Math.floor((currentTime - startTime) / 1000);

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      let timeStr = '';
      if (hours > 0) timeStr = `${hours}h ${minutes}m`;
      else if (minutes > 0) timeStr = `${minutes}m ${seconds}s`;
      else timeStr = `${seconds}s`;

      return { time: timeStr, color: 'text-blue-700', label: 'En progreso' };
    }

    // Task completed
    if (completed_at) {
      const startTime = new Date(started_at);
      const endTime = new Date(completed_at);
      const elapsed = Math.floor((endTime - startTime) / 1000);

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);

      let timeStr = '';
      if (hours > 0) timeStr = `${hours}h ${minutes}m`;
      else timeStr = `${minutes}m`;

      return { time: timeStr, color: 'text-green-700', label: 'Completado' };
    }

    return { time: '-', color: 'text-gray-400', label: '' };
  };

  const getStatusBadge = (checkout) => {
    const { cleaning_status, actual_checkout_time } = checkout;

    // If no actual_checkout_time (regardless of cleaning task status), it's waiting for checkout
    if (!actual_checkout_time) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <Clock className="w-3 h-3" />
          Esp. Checkout
        </span>
      );
    }

    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    const icons = {
      pending: <AlertCircle className="w-3 h-3" />,
      in_progress: <Loader className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      cancelled: <XCircle className="w-3 h-3" />
    };

    const labels = {
      pending: 'Pend.',
      in_progress: 'Progreso',
      completed: 'Listo',
      cancelled: 'Cancel.'
    };

    if (!cleaning_status) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-3 h-3" />
          Sin Asig.
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${styles[cleaning_status]}`}>
        {icons[cleaning_status]}
        {labels[cleaning_status]}
      </span>
    );
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';

    // Handle TIME format (HH:MM, HH:MM:SS, or HH:MM:SS.mmm) - convert to 12-hour format
    if (/^\d{2}:\d{2}/.test(timeString) && !timeString.includes('T') && !timeString.includes('Z')) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${period}`;
    }

    // Handle TIMESTAMP format - use the configured timezone with AM/PM format
    if (timeString.includes('T') || timeString.includes('Z')) {
      try {
        const date = new Date(timeString);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone
        });
      } catch (e) {
        return '-';
      }
    }

    return '-';
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Checkouts</h1>
          <p className="text-gray-600">Control de salidas y limpieza • Auto-actualización cada 30s</p>
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="Refrescar para ver cambios de Telegram"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refrescar
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reporte de Checkouts</h1>
        <p className="text-gray-600">Fecha: {new Date(date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p className="text-gray-600">Total de checkouts: {report?.total_checkouts || 0}</p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-6 print:shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Total Checkouts */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Checkouts</p>
              <p className="text-2xl font-bold text-gray-900">{report?.total_checkouts || 0}</p>
            </div>
          </div>

          {/* Esperando Checkout */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <label className="absolute -top-1 -right-1 cursor-pointer print:hidden">
                <input
                  type="checkbox"
                  checked={statusFilters.waiting_checkout}
                  onChange={() => handleStatusFilterChange('waiting_checkout')}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-gray-600">Esp. Checkout</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'pending' && !c.actual_checkout_time).length || 0}
              </p>
            </div>
          </div>

          {/* Checked Out (antes Pendientes) */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <label className="absolute -top-1 -right-1 cursor-pointer print:hidden">
                <input
                  type="checkbox"
                  checked={statusFilters.checked_out}
                  onChange={() => handleStatusFilterChange('checked_out')}
                  className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-gray-600">Checked Out</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'pending' && c.actual_checkout_time).length || 0}
              </p>
            </div>
          </div>

          {/* En Progreso */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Loader className="w-6 h-6 text-blue-600" />
              </div>
              <label className="absolute -top-1 -right-1 cursor-pointer print:hidden">
                <input
                  type="checkbox"
                  checked={statusFilters.in_progress}
                  onChange={() => handleStatusFilterChange('in_progress')}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-gray-600">En Progreso</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'in_progress').length || 0}
              </p>
            </div>
          </div>

          {/* Completados */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <label className="absolute -top-1 -right-1 cursor-pointer print:hidden">
                <input
                  type="checkbox"
                  checked={statusFilters.completed}
                  onChange={() => handleStatusFilterChange('completed')}
                  className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completados</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'completed').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto print:shadow-none">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID Res.</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Propiedad</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">H. Prog.</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">H. Report.</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asignado</th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase print:hidden">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {report?.checkouts && report.checkouts.length > 0 ? (
              report.checkouts.map((checkout) => {
                const totalGuests = checkout.adults + checkout.children + checkout.infants;
                return (
                  <tr key={checkout.id} className={checkout.actual_checkout_time ? 'bg-yellow-50' : ''}>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-700">#{checkout.id}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-sm text-gray-900">{checkout.property_name}</div>
                        <div className="text-xs text-gray-500">{checkout.property_type_name}</div>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                      {checkout.reference || '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                      {checkout.cleaning_task_type === 'check_out' ? 'Aseo Completo' :
                       checkout.cleaning_task_type === 'stay_over' ? 'Aseo Liviano' :
                       checkout.cleaning_task_type === 'deep_cleaning' ? 'Aseo Profundo' :
                       checkout.cleaning_task_type || '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {(checkout.actual_checkout_time || checkout.checkout_time) ? (
                        <div className={`flex items-center gap-1 text-xs ${checkout.actual_checkout_time ? 'text-orange-700 font-medium' : 'text-gray-700'}`}>
                          <Clock className="w-3 h-3" />
                          {formatTime(checkout.actual_checkout_time || checkout.checkout_time)}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {checkout.started_at ? (
                        <div className="flex items-center gap-1 text-xs text-green-700 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {formatTime(checkout.started_at)}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {getStatusBadge(checkout)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                      {checkout.assigned_to_name || '-'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {(() => {
                        const timeData = calculateElapsedTime(checkout);
                        if (timeData.time === '-') {
                          return <span className="text-gray-400 text-xs">-</span>;
                        }
                        return (
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-1 font-mono text-xs ${timeData.color}`}>
                              <Timer className="w-3 h-3" />
                              {timeData.time}
                            </div>
                            {timeData.label && (
                              <span className="text-xs text-gray-500 ml-4">{timeData.label}</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-center print:hidden">
                      {!checkout.completed_at && (
                        <div className="flex items-center justify-center gap-1">
                          {/* Start Task Button - only show if checkout reported and task not started */}
                          {checkout.actual_checkout_time && !checkout.started_at && (
                            <button
                              onClick={() => handleStartTask(checkout)}
                              className="p-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                              title="Iniciar Tarea"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Complete Task Button - only show if task started but not completed */}
                          {checkout.started_at && !checkout.completed_at && (
                            <button
                              onClick={() => handleCompleteTask(checkout)}
                              className="p-1.5 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                              title="Terminar Tarea"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="px-6 py-12 text-center text-gray-500">
                  No hay checkouts programados para esta fecha
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-sm text-gray-600">
        <p>Impreso el {new Date().toLocaleString('es-CO')}</p>
        <p>MDCLodging - Sistema de Gestión Hotelera</p>
      </div>

      {/* Checkout Confirmation Modal */}
      {/* Start Task Modal */}
      {showStartTaskModal && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowStartTaskModal(false)} />

          {/* Modal */}
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Iniciar Tarea de Limpieza</h2>
                <button onClick={() => setShowStartTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {selectedTask.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Checkout reportado:</span> {formatTime(selectedTask.actual_checkout_time)}
                  </p>
                </div>

                {housekeepingUsers.length === 0 ? (
                  // No users logged in
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-semibold mb-2">
                      ⚠️ No hay usuarios de housekeeping conectados
                    </p>
                    <p className="text-sm text-yellow-700">
                      ¿Deseas iniciar la tarea sin asignar a nadie? La tarea quedará pendiente de asignación.
                    </p>
                  </div>
                ) : (
                  // User selection
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asignar a:
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {housekeepingUsers.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="radio"
                            name="assignedUser"
                            value={user.id}
                            checked={selectedUser === user.id}
                            onChange={() => setSelectedUser(user.id)}
                            className="mr-3"
                          />
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">Housekeeping</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowStartTaskModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmStartTask}
                  disabled={housekeepingUsers.length > 0 && !selectedUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Iniciar Tarea
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Task Confirmation Modal */}
      {showCompleteTaskModal && taskToComplete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCompleteTaskModal(false)} />

          {/* Modal */}
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Confirmar Completación</h2>
                <button onClick={() => setShowCompleteTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {taskToComplete.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Asignado a:</span> {taskToComplete.assigned_to_name || 'Sin asignar'}
                  </p>
                </div>

                <p className="text-gray-700">
                  ¿Está seguro que desea marcar esta tarea como completada?
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCompleteTaskModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCompleteTask}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
