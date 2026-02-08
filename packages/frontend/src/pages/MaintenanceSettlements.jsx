import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  DollarSign, Calendar, CheckCircle, XCircle, Clock, User,
  Eye, Check, X, Plus, Edit2, Trash2, AlertCircle, Download
} from 'lucide-react';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

const TASK_TYPE_EMOJI = {
  maintenance: '🔧',
  inspection: '🔍',
  repair: '🛠️',
  other: '📋'
};

const TASK_TYPE_LABELS = {
  maintenance: 'MANTENIMIENTO',
  inspection: 'INSPECCIÓN',
  repair: 'REPARACIÓN',
  other: 'OTRA'
};

const STATUS_CONFIG = {
  draft: {
    label: 'Borrador',
    color: 'gray',
    icon: Edit2
  },
  submitted: {
    label: 'Pendiente',
    color: 'yellow',
    icon: Clock
  },
  approved: {
    label: 'Aprobada',
    color: 'green',
    icon: CheckCircle
  },
  rejected: {
    label: 'Rechazada',
    color: 'red',
    icon: XCircle
  },
  paid: {
    label: 'Pagada',
    color: 'blue',
    icon: DollarSign
  }
};

export default function MaintenanceSettlements() {
  const { user } = useSelector((state) => state.auth);
  const userRoles = Array.isArray(user?.role) ? user.role : [user?.role];
  const isAdmin = userRoles.some(role => ['admin', 'supervisor'].includes(role));

  const [activeTab, setActiveTab] = useState('settlements');
  const [settlements, setSettlements] = useState([]);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [rates, setRates] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [rateToDelete, setRateToDelete] = useState(null);

  const [filters, setFilters] = useState({
    status: '',
    user_id: '',
    from_date: '',
    to_date: ''
  });

  const [rateForm, setRateForm] = useState({
    property_type_id: '',
    task_type: '',
    rate: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });

  const [reviewForm, setReviewForm] = useState({
    action: 'approve',
    notes: ''
  });

  useEffect(() => {
    if (activeTab === 'settlements') {
      fetchSettlements();
    } else if (activeTab === 'rates' && isAdmin) {
      fetchRates();
      fetchPropertyTypes();
    }
  }, [activeTab, filters]);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);

      const response = await api.get(`/maintenance-settlements?${params}`);
      setSettlements(response.data);
    } catch (error) {
      console.error('Error fetching settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlementDetail = async (id) => {
    try {
      const response = await api.get(`/maintenance-settlements/${id}`);
      setSelectedSettlement(response.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching settlement detail:', error);
    }
  };

  const fetchRates = async () => {
    setLoading(true);
    try {
      const response = await api.get('/maintenance-settlements/rates');
      setRates(response.data);
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyTypes = async () => {
    try {
      const response = await api.get('/property-types');
      setPropertyTypes(response.data);
    } catch (error) {
      console.error('Error fetching property types:', error);
    }
  };

  const handleSaveRate = async () => {
    if (!rateForm.property_type_id || !rateForm.task_type || !rateForm.rate) {
      toast.error('Todos los campos son requeridos');
      return;
    }

    try {
      await api.post('/maintenance-settlements/rates', rateForm);
      toast.success('Tarifa guardada exitosamente');
      setShowRateModal(false);
      setRateForm({ property_type_id: '', task_type: '', rate: '' });
      fetchRates();
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleDeleteRate = (rate) => {
    setRateToDelete(rate);
    setShowConfirmModal(true);
  };

  const confirmDeleteRate = async () => {
    if (!rateToDelete) return;

    try {
      await api.delete(`/maintenance-settlements/rates/${rateToDelete.id}`);
      toast.success('Tarifa eliminada');
      fetchRates();
    } catch (error) {
      // Error already handled
    } finally {
      setRateToDelete(null);
    }
  };

  const handleReviewSettlement = async () => {
    if (reviewForm.action === 'reject' && !reviewForm.notes) {
      toast.error('Debes proporcionar un motivo de rechazo');
      return;
    }

    try {
      if (reviewForm.action === 'approve') {
        await api.put(`/maintenance-settlements/${selectedSettlement.id}/approve`, {
          notes: reviewForm.notes
        });
        toast.success('Liquidación aprobada');
      } else {
        await api.put(`/maintenance-settlements/${selectedSettlement.id}/reject`, {
          notes: reviewForm.notes
        });
        toast.success('Liquidación rechazada');
      }

      setShowReviewModal(false);
      setShowDetailModal(false);
      fetchSettlements();
    } catch (error) {
      // Error already handled
    }
  };

  const handleRegisterPayment = async () => {
    if (!paymentForm.amount || !paymentForm.payment_date) {
      toast.error('Monto y fecha son requeridos');
      return;
    }

    try {
      await api.post(`/maintenance-settlements/${selectedSettlement.id}/payments`, paymentForm);
      toast.success('Pago registrado exitosamente');
      setShowPaymentModal(false);
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        reference_number: '',
        notes: ''
      });
      fetchSettlementDetail(selectedSettlement.id);
      fetchSettlements();
    } catch (error) {
      // Error already handled
    }
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      blue: 'bg-blue-100 text-blue-800'
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClasses[config.color]}`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Liquidaciones de Mantenimiento</h1>
        <p className="text-gray-600">Gestiona pagos y liquidaciones del personal de mantenimiento</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settlements')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'settlements'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="inline-block w-5 h-5 mr-2" />
            Liquidaciones
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('rates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rates'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Edit2 className="inline-block w-5 h-5 mr-2" />
              Tarifas
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todos los estados</option>
                <option value="submitted">Pendiente</option>
                <option value="approved">Aprobada</option>
                <option value="rejected">Rechazada</option>
                <option value="paid">Pagada</option>
              </select>

              <input
                type="date"
                value={filters.from_date}
                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                placeholder="Fecha desde"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />

              <input
                type="date"
                value={filters.to_date}
                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                placeholder="Fecha hasta"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />

              <button
                onClick={() => setFilters({ status: '', user_id: '', from_date: '', to_date: '' })}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {/* Settlements List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tareas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No hay liquidaciones para mostrar
                    </td>
                  </tr>
                ) : (
                  settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400" />
                          {new Date(settlement.settlement_date).toLocaleDateString('es-CO')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{settlement.user_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {settlement.total_tasks} tarea{settlement.total_tasks !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-green-600">
                          ${parseFloat(settlement.total_amount).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(settlement.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => fetchSettlementDetail(settlement.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-primary-600 hover:bg-primary-50 rounded-lg"
                        >
                          <Eye size={16} />
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rates' && isAdmin && (
        <div className="space-y-4">
          {/* Add Rate Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowRateModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Nueva Tarifa
            </button>
          </div>

          {/* Rates Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo de Propiedad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo de Aseo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarifa</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No hay tarifas configuradas
                    </td>
                  </tr>
                ) : (
                  rates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {rate.property_type_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <span>{TASK_TYPE_EMOJI[rate.task_type]}</span>
                          <span>{TASK_TYPE_LABELS[rate.task_type]}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-green-600">
                          ${parseFloat(rate.rate).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDeleteRate(rate)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Detalle de Liquidación</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            {/* Settlement Info */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Usuario</p>
                <p className="font-semibold">{selectedSettlement.user_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha</p>
                <p className="font-semibold">
                  {new Date(selectedSettlement.settlement_date).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <div className="mt-1">{getStatusBadge(selectedSettlement.status)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-green-600">
                  ${parseFloat(selectedSettlement.total_amount).toFixed(0)}
                </p>
              </div>
            </div>

            {/* Tasks */}
            <div className="mb-6">
              <h4 className="font-semibold text-lg mb-3">Tareas Realizadas ({selectedSettlement.items?.length || 0})</h4>
              <div className="space-y-2">
                {selectedSettlement.items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{TASK_TYPE_EMOJI[item.task_type]}</span>
                      <div>
                        <p className="font-medium">{item.property_name}</p>
                        <p className="text-sm text-gray-600">
                          {TASK_TYPE_LABELS[item.task_type]} - {item.property_type_name}
                        </p>
                        {item.work_duration_minutes && (
                          <p className="text-xs text-gray-500">
                            ⏱️ Duración: {Math.floor(item.work_duration_minutes / 60)}h {item.work_duration_minutes % 60}m
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-green-600">${parseFloat(item.rate).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Notes */}
            {selectedSettlement.review_notes && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="font-semibold text-yellow-800 mb-1">Notas de Revisión</p>
                <p className="text-sm text-yellow-700">{selectedSettlement.review_notes}</p>
                {selectedSettlement.reviewer_name && (
                  <p className="text-xs text-yellow-600 mt-1">Por: {selectedSettlement.reviewer_name}</p>
                )}
              </div>
            )}

            {/* Payments */}
            {selectedSettlement.payments && selectedSettlement.payments.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-lg mb-3">Pagos Registrados</h4>
                <div className="space-y-2">
                  {selectedSettlement.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium">${parseFloat(payment.amount).toFixed(0)}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString('es-CO')} - {payment.payment_method}
                        </p>
                        {payment.reference_number && (
                          <p className="text-xs text-gray-500">Ref: {payment.reference_number}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Por: {payment.paid_by_name}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-gray-100 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Pendiente de pago:</span>
                  <span className="text-xl font-bold text-orange-600">
                    ${parseFloat(selectedSettlement.pending_amount || 0).toFixed(0)}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              {selectedSettlement.status === 'submitted' && isAdmin && (
                <button
                  onClick={() => {
                    setReviewForm({ action: 'approve', notes: '' });
                    setShowReviewModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Check size={18} />
                  Aprobar
                </button>
              )}
              {selectedSettlement.status === 'submitted' && isAdmin && (
                <button
                  onClick={() => {
                    setReviewForm({ action: 'reject', notes: '' });
                    setShowReviewModal(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <X size={18} />
                  Rechazar
                </button>
              )}
              {selectedSettlement.status === 'approved' && isAdmin && selectedSettlement.pending_amount > 0 && (
                <button
                  onClick={() => {
                    setPaymentForm({
                      amount: selectedSettlement.pending_amount.toString(),
                      payment_date: new Date().toISOString().split('T')[0],
                      payment_method: 'cash',
                      reference_number: '',
                      notes: ''
                    });
                    setShowPaymentModal(true);
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                >
                  <DollarSign size={18} />
                  Registrar Pago
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rate Modal */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Nueva Tarifa</h3>
              <button
                onClick={() => setShowRateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Propiedad
                </label>
                <select
                  value={rateForm.property_type_id}
                  onChange={(e) => setRateForm({ ...rateForm, property_type_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar...</option>
                  {propertyTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Aseo
                </label>
                <select
                  value={rateForm.task_type}
                  onChange={(e) => setRateForm({ ...rateForm, task_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="maintenance">🔧 MANTENIMIENTO - Trabajo general</option>
                  <option value="inspection">🔍 INSPECCIÓN - Revisión</option>
                  <option value="repair">🛠️ REPARACIÓN - Arreglo</option>
                  <option value="other">📋 OTRA - Tarea especial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tarifa ($)
                </label>
                <input
                  type="number"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveRate}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Guardar
              </button>
              <button
                onClick={() => setShowRateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {reviewForm.action === 'approve' ? 'Aprobar Liquidación' : 'Rechazar Liquidación'}
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas {reviewForm.action === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  placeholder={reviewForm.action === 'reject' ? 'Explica el motivo del rechazo...' : 'Notas opcionales...'}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReviewSettlement}
                className={`flex-1 px-4 py-2 text-white rounded-lg ${
                  reviewForm.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewForm.action === 'approve' ? 'Aprobar' : 'Rechazar'}
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Registrar Pago</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Pago <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="check">Cheque</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número de Referencia
                </label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Notas opcionales..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRegisterPayment}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Registrar Pago
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setRateToDelete(null);
        }}
        onConfirm={confirmDeleteRate}
        title="Eliminar Tarifa"
        message={`¿Está seguro de eliminar la tarifa de ${rateToDelete?.property_type_name} - ${rateToDelete?.task_type ? TASK_TYPE_LABELS[rateToDelete.task_type] : ''}?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
