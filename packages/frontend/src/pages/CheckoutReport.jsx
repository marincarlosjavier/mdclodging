import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, XCircle, Loader, LogOut, X } from 'lucide-react';
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

  useEffect(() => {
    fetchReport();
  }, [date]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reservations/checkout-report?date=${date}`);
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
        data: { actual_checkout_time: actualCheckoutTime }
      })).unwrap();

      const timeStr = checkoutType === 'now' ? 'inmediato' : `a las ${scheduledTime}`;
      toast.success(`Checkout reportado correctamente ${timeStr}. Notificación enviada a housekeeping.`);

      setShowCheckoutModal(false);
      setSelectedCheckout(null);
      setCheckoutType('now');
      setScheduledTime('');
      fetchReport();
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const getStatusBadge = (cleaningStatus) => {
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

    if (!cleaningStatus) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-4 h-4" />
          Sin Asignar
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[cleaningStatus]}`}>
        {icons[cleaningStatus]}
        {labels[cleaningStatus]}
      </span>
    );
  };

  const formatTime = (timeString) => {
    return formatColombiaTime(timeString, { hour: '2-digit', minute: '2-digit' });
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hora Real</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huéspedes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado Limpieza</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase print:hidden">Asignado A</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase print:hidden">Acciones</th>
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
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4" />
                        {checkout.checkout_time || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {checkout.actual_checkout_time ? (
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          {formatTime(checkout.actual_checkout_time)}
                        </div>
                      ) : (
                        <span className="text-gray-400">No reportado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Users className="w-4 h-4" />
                        {totalGuests}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(checkout.cleaning_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 print:hidden">
                      {checkout.assigned_to_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right print:hidden">
                      {!checkout.actual_checkout_time && checkout.reservation_status === 'active' && (
                        <button
                          onClick={() => handleReportCheckout(checkout)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                          title="Reportar Checkout"
                        >
                          <LogOut className="w-4 h-4" />
                          Reportar
                        </button>
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

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Esto creará una tarea de limpieza pendiente y notificará al equipo de housekeeping vía Telegram.
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmCheckout}
                  disabled={checkoutType === 'scheduled' && !scheduledTime}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Confirmar Checkout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
