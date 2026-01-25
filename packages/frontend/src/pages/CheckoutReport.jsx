import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, XCircle, Loader, LogOut, X, Edit, Play, Timer } from 'lucide-react';
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
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [checkoutType, setCheckoutType] = useState('now'); // 'now' or 'scheduled'
  const [scheduledTime, setScheduledTime] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [showStartTaskModal, setShowStartTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [housekeepingUsers, setHousekeepingUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [date, showCompleted]);

  // Update current time every second for elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reservations/checkout-report?date=${date}&show_completed=${showCompleted}`);
      setReport(response.data);
    } catch (error) {
      console.error('Error fetching checkout report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReportCheckout = (checkout) => {
    setSelectedCheckout(checkout);
    setCheckoutType('now');
    setScheduledTime('');
    setIsPriority(false);
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    try {
      let actualCheckoutTime;

      if (checkoutType === 'now') {
        // Get current time in Colombia and convert to ISO
        actualCheckoutTime = createColombiaDateTime(
          getTodayInColombia(),
          new Date().toLocaleTimeString('en-US', {
            timeZone: 'America/Bogota',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          })
        );
      } else {
        // Use the selected date and time in Colombia timezone
        actualCheckoutTime = createColombiaDateTime(date, scheduledTime);
      }

      await dispatch(updateReservation({
        id: selectedCheckout.id,
        data: {
          actual_checkout_time: actualCheckoutTime,
          is_priority: isPriority
        }
      })).unwrap();

      const timeStr = checkoutType === 'now' ? 'inmediato' : `a las ${scheduledTime}`;
      const priorityMsg = isPriority ? ' [PRIORIDAD]' : '';
      toast.success(`Checkout reportado correctamente ${timeStr}${priorityMsg}. Notificación enviada a housekeeping.`);

      setShowCheckoutModal(false);
      setSelectedCheckout(null);
      setCheckoutType('now');
      setScheduledTime('');
      setIsPriority(false);
      fetchReport();
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleStartTask = async (checkout) => {
    try {
      // Get users who are logged in via Telegram (uses telegram_roles, not system role)
      const response = await api.get('/users?logged_in=true');
      const loggedInUsers = response.data;

      setSelectedTask(checkout);
      setHousekeepingUsers(loggedInUsers);

      if (loggedInUsers.length === 0) {
        // No users logged in - show warning modal
        setSelectedUser(null);
        setShowStartTaskModal(true);
      } else if (loggedInUsers.length === 1) {
        // Only one user - assign automatically
        await startTaskWithUser(checkout.cleaning_task_id, loggedInUsers[0].id);
      } else {
        // Multiple users - show selection modal
        setSelectedUser(null);
        setShowStartTaskModal(true);
      }
    } catch (error) {
      console.error('Error fetching housekeeping users:', error);
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

  const handleCancelCheckout = async () => {
    try {
      await dispatch(updateReservation({
        id: selectedCheckout.id,
        data: {
          actual_checkout_time: null
        }
      })).unwrap();

      toast.success('Checkout cancelado correctamente');
      setShowCheckoutModal(false);
      setSelectedCheckout(null);
      fetchReport();
    } catch (error) {
      toast.error('Error al cancelar checkout');
    }
  };

  const handleCompleteTask = async (checkout) => {
    // Ask for confirmation
    const confirmed = window.confirm('¿Está seguro que desea marcar esta tarea como completada?');
    if (!confirmed) return;

    try {
      await api.put(`/cleaning-tasks/${checkout.cleaning_task_id}/complete`);
      toast.success('Tarea completada correctamente');
      fetchReport();
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error('Error al completar la tarea');
    }
  };

  const calculateElapsedTime = (checkout) => {
    const { actual_checkout_time, started_at, completed_at } = checkout;

    // No checkout reported yet
    if (!actual_checkout_time) {
      return { time: '-', color: 'text-gray-400', label: '' };
    }

    // Checkout reported, waiting to start
    if (actual_checkout_time && !started_at) {
      const checkoutTime = new Date(actual_checkout_time);
      const elapsed = Math.floor((currentTime - checkoutTime) / 1000);

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
    const { cleaning_status } = checkout;

    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    const icons = {
      pending: <AlertCircle className="w-4 h-4" />,
      in_progress: <Loader className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      cancelled: <XCircle className="w-4 h-4" />
    };

    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado'
    };

    if (!cleaning_status) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-4 h-4" />
          Sin Asignar
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[cleaning_status]}`}>
        {icons[cleaning_status]}
        {labels[cleaning_status]}
      </span>
    );
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';

    console.log('[DEBUG formatTime] Input:', timeString);

    // If it's just a time (HH:MM or HH:MM:SS), extract HH:MM
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeString)) {
      console.log('[DEBUG formatTime] Simple time format, returning:', timeString.substring(0, 5));
      return timeString.substring(0, 5); // Return HH:MM
    }

    // Otherwise, format as Colombia time
    const result = formatColombiaTime(timeString, { hour: '2-digit', minute: '2-digit' });
    console.log('[DEBUG formatTime] Colombia time result:', result);
    return result;
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
          <p className="text-gray-600">Control de salidas y limpieza</p>
        </div>
        <div className="flex gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showCompleted
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {showCompleted ? 'Ocultar' : 'Mostrar'} Completadas
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Checkouts</p>
              <p className="text-2xl font-bold text-gray-900">{report?.total_checkouts || 0}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'pending').length || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Loader className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">En Progreso</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkouts.filter(c => c.cleaning_status === 'in_progress').length || 0}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
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
      <div className="bg-white rounded-lg shadow overflow-hidden print:shadow-none">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Propiedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Programada</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Reportada</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asignado A</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase print:hidden">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {report?.checkouts && report.checkouts.length > 0 ? (
              report.checkouts.map((checkout) => {
                const totalGuests = checkout.adults + checkout.children + checkout.infants;
                return (
                  <tr key={checkout.id} className={checkout.actual_checkout_time ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{checkout.property_name}</div>
                        <div className="text-sm text-gray-500">{checkout.property_type_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(checkout.actual_checkout_time || checkout.checkout_time) ? (
                        <div className={`flex items-center gap-2 ${checkout.actual_checkout_time ? 'text-orange-700 font-medium' : 'text-gray-700'}`}>
                          <Clock className="w-4 h-4" />
                          {formatTime(checkout.actual_checkout_time || checkout.checkout_time)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {checkout.started_at ? (
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          {formatTime(checkout.started_at)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(checkout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {checkout.assigned_to_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const timeData = calculateElapsedTime(checkout);
                        if (timeData.time === '-') {
                          return <span className="text-gray-400">-</span>;
                        }
                        return (
                          <div className="flex flex-col">
                            <div className={`flex items-center gap-1 font-mono text-sm ${timeData.color}`}>
                              <Timer className="w-4 h-4" />
                              {timeData.time}
                            </div>
                            {timeData.label && (
                              <span className="text-xs text-gray-500 ml-5">{timeData.label}</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center print:hidden">
                      {checkout.reservation_status === 'active' && !checkout.completed_at && (
                        <div className="flex items-center justify-center gap-2">
                          {/* Report/Edit Checkout Button - disabled when task has started */}
                          <button
                            onClick={() => handleReportCheckout(checkout)}
                            disabled={checkout.started_at !== null}
                            className={`p-2 rounded-lg transition-colors ${
                              checkout.started_at
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : checkout.actual_checkout_time
                                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                            title={
                              checkout.started_at
                                ? "No se puede corregir - tarea iniciada"
                                : checkout.actual_checkout_time
                                  ? "Corregir Checkout"
                                  : "Reportar Checkout"
                            }
                          >
                            {checkout.actual_checkout_time ? <Edit className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                          </button>

                          {/* Start Task Button - only show if checkout reported and task not started */}
                          {checkout.actual_checkout_time && !checkout.started_at && (
                            <button
                              onClick={() => handleStartTask(checkout)}
                              className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                              title="Iniciar Tarea"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {/* Complete Task Button - only show if task started but not completed */}
                          {checkout.started_at && !checkout.completed_at && (
                            <button
                              onClick={() => handleCompleteTask(checkout)}
                              className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                              title="Terminar Tarea"
                            >
                              <CheckCircle className="w-4 h-4" />
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
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
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
      {showCheckoutModal && selectedCheckout && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCheckoutModal(false)} />

          {/* Modal */}
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Reportar Checkout</h2>
                <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {selectedCheckout.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Checkout programado:</span> {selectedCheckout.checkout_time || 'No especificado'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Huéspedes:</span> {selectedCheckout.adults + selectedCheckout.children + selectedCheckout.infants}
                  </p>
                </div>

                {/* Checkout Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cuándo sale el huésped?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="checkoutType"
                        value="now"
                        checked={checkoutType === 'now'}
                        onChange={(e) => setCheckoutType(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Checkout Inmediato</div>
                        <div className="text-sm text-gray-500">El huésped ya salió o está saliendo ahora</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="checkoutType"
                        value="scheduled"
                        checked={checkoutType === 'scheduled'}
                        onChange={(e) => setCheckoutType(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Checkout Programado</div>
                        <div className="text-sm text-gray-500">El huésped saldrá a una hora específica</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Time Selector (only shown when scheduled) */}
                {checkoutType === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de salida
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Selecciona la hora aproximada en que el huésped saldrá
                    </p>
                  </div>
                )}

                {/* Priority Checkbox */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPriority"
                    checked={isPriority}
                    onChange={(e) => setIsPriority(e.target.checked)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="isPriority" className="ml-2 text-sm font-medium text-gray-700">
                    🔴 Marcar como <span className="text-red-600">PRIORIDAD</span>
                  </label>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Esto creará una tarea de limpieza pendiente y notificará al equipo de housekeeping vía Telegram.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-between items-center mt-6">
                {/* Cancel Checkout Button - only show when editing existing checkout */}
                {selectedCheckout.actual_checkout_time ? (
                  <button
                    type="button"
                    onClick={handleCancelCheckout}
                    className="px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar Checkout
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleConfirmCheckout}
                    disabled={checkoutType === 'scheduled' && !scheduledTime}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {selectedCheckout.actual_checkout_time ? 'Actualizar' : 'Confirmar'} Checkout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
