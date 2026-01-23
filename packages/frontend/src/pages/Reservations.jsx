import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReservations, createReservation, updateReservation, deleteReservation } from '../store/slices/reservationsSlice';
import { fetchProperties } from '../store/slices/propertiesSlice';
import { Plus, Calendar, Users, Coffee, Edit, Trash2, X, ArrowUpDown } from 'lucide-react';
import { toast } from 'react-toastify';

export default function Reservations() {
  const dispatch = useDispatch();
  const { reservations, loading } = useSelector((state) => state.reservations);
  const { properties } = useSelector((state) => state.properties);
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [sortColumn, setSortColumn] = useState('check_in_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [formData, setFormData] = useState({
    property_id: '',
    check_in_date: '',
    check_out_date: '',
    checkout_time: '12:00',
    adults: 1,
    children: 0,
    infants: 0,
    has_breakfast: false,
    status: 'active',
    additional_requirements: '',
    notes: ''
  });

  useEffect(() => {
    dispatch(fetchReservations());
    dispatch(fetchProperties());
  }, [dispatch]);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedReservations = () => {
    const sorted = [...reservations].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'property_name':
          aValue = a.property_name || '';
          bValue = b.property_name || '';
          break;
        case 'check_in_date':
          aValue = new Date(a.check_in_date);
          bValue = new Date(b.check_in_date);
          break;
        case 'check_out_date':
          aValue = new Date(a.check_out_date);
          bValue = new Date(b.check_out_date);
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getAvailableProperties = () => {
    if (!formData.check_in_date || !formData.check_out_date) {
      return properties.filter(p => p.is_active);
    }

    // Filter out properties that are already reserved for the selected dates
    return properties.filter(p => {
      if (!p.is_active) return false;

      // If editing, allow the same property
      if (editingReservation && p.id === editingReservation.property_id) return true;

      // Check if property has overlapping reservations
      const hasOverlap = reservations.some(r => {
        // Skip cancelled reservations and the current reservation being edited
        if (r.status === 'cancelled') return false;
        if (editingReservation && r.id === editingReservation.id) return false;
        if (r.property_id !== p.id) return false;

        const rCheckIn = new Date(r.check_in_date);
        const rCheckOut = new Date(r.check_out_date);
        const newCheckIn = new Date(formData.check_in_date);
        const newCheckOut = new Date(formData.check_out_date);

        // Check for overlap
        return (
          (newCheckIn <= rCheckIn && newCheckOut > rCheckIn) ||
          (newCheckIn < rCheckOut && newCheckOut >= rCheckOut) ||
          (newCheckIn >= rCheckIn && newCheckOut <= rCheckOut)
        );
      });

      return !hasOverlap;
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de cancelar esta reserva? Esto también cancelará las tareas de limpieza asociadas.')) return;
    try {
      await dispatch(deleteReservation(id)).unwrap();
      toast.success('Reserva cancelada correctamente');
      dispatch(fetchReservations());
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleEdit = (reservation) => {
    setEditingReservation(reservation);
    setFormData({
      property_id: reservation.property_id,
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      checkout_time: reservation.checkout_time || '12:00',
      adults: reservation.adults,
      children: reservation.children,
      infants: reservation.infants,
      has_breakfast: reservation.has_breakfast,
      status: reservation.status,
      additional_requirements: reservation.additional_requirements || '',
      notes: reservation.notes || ''
    });
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingReservation(null);
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setFormData({
      property_id: '',
      check_in_date: today,
      check_out_date: tomorrowStr,
      checkout_time: '12:00',
      adults: 1,
      children: 0,
      infants: 0,
      has_breakfast: false,
      status: 'active',
      additional_requirements: '',
      notes: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.property_id) {
      toast.error('Debe seleccionar una propiedad');
      return;
    }
    if (!formData.check_in_date || !formData.check_out_date) {
      toast.error('Debe especificar fechas de entrada y salida');
      return;
    }
    if (new Date(formData.check_out_date) <= new Date(formData.check_in_date)) {
      toast.error('La fecha de salida debe ser posterior a la fecha de entrada');
      return;
    }

    try {
      if (editingReservation) {
        await dispatch(updateReservation({ id: editingReservation.id, data: formData })).unwrap();
        toast.success('Reserva actualizada correctamente');
      } else {
        const result = await dispatch(createReservation(formData)).unwrap();
        toast.success(`Reserva creada correctamente. Se generaron ${result.cleaning_tasks_created} tareas de limpieza.`);
      }
      setShowModal(false);
      dispatch(fetchReservations());
    } catch (error) {
      // Error already handled
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Activa',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const calculateNights = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const SortableHeader = ({ column, children }) => (
    <th
      onClick={() => handleSort(column)}
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </th>
  );

  const availableProperties = getAvailableProperties();
  const sortedReservations = getSortedReservations();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de check-ins y reservas</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Check-in
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Activas</p>
              <p className="text-2xl font-bold text-gray-900">
                {reservations.filter(r => r.status === 'active').length}
              </p>
            </div>
            <Calendar className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Huéspedes Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {reservations
                  .filter(r => r.status === 'active')
                  .reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0) + (r.infants || 0), 0)}
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Desayunos Hoy</p>
              <p className="text-2xl font-bold text-gray-900">
                {reservations
                  .filter(r => r.status === 'active' && r.has_breakfast)
                  .reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0)}
              </p>
            </div>
            <Coffee className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader column="property_name">Propiedad</SortableHeader>
              <SortableHeader column="check_in_date">Check-in</SortableHeader>
              <SortableHeader column="check_out_date">Check-out</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Noches</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huéspedes</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Desayuno</th>
              <SortableHeader column="status">Estado</SortableHeader>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : sortedReservations.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  No hay reservas registradas
                </td>
              </tr>
            ) : (
              sortedReservations.map((reservation) => (
                <tr key={reservation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{reservation.property_name}</div>
                    <div className="text-xs text-gray-500">{reservation.property_type_name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(reservation.check_in_date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(reservation.check_out_date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {calculateNights(reservation.check_in_date, reservation.check_out_date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{reservation.adults || 0}</span>
                      {(reservation.children > 0 || reservation.infants > 0) && (
                        <span className="text-gray-500">
                          + {(reservation.children || 0) + (reservation.infants || 0)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {reservation.has_breakfast ? (
                      <Coffee className="w-5 h-5 text-orange-500" />
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(reservation.status)}`}>
                      {getStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(reservation)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(reservation.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Cancelar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Check-in Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingReservation ? 'Editar Reserva' : 'Nuevo Check-in'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Dates - FIRST */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Entrada *
                  </label>
                  <input
                    type="date"
                    name="check_in_date"
                    value={formData.check_in_date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Salida *
                  </label>
                  <input
                    type="date"
                    name="check_out_date"
                    value={formData.check_out_date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Checkout Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora de Check-out
                </label>
                <input
                  type="time"
                  name="checkout_time"
                  value={formData.checkout_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Hora estimada de salida del huésped
                </p>
              </div>

              {/* Property Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Propiedad *
                  {formData.check_in_date && formData.check_out_date && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({availableProperties.length} disponibles)
                    </span>
                  )}
                </label>
                <select
                  name="property_id"
                  value={formData.property_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar propiedad</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} - {property.type_name}
                    </option>
                  ))}
                </select>
                {formData.check_in_date && formData.check_out_date && availableProperties.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No hay propiedades disponibles para estas fechas
                  </p>
                )}
              </div>

              {/* Guest Counts */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adultos
                  </label>
                  <input
                    type="number"
                    name="adults"
                    value={formData.adults}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Niños
                  </label>
                  <input
                    type="number"
                    name="children"
                    value={formData.children}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Infantes
                  </label>
                  <input
                    type="number"
                    name="infants"
                    value={formData.infants}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Status (only show when editing) */}
              {editingReservation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Activa</option>
                    <option value="completed">Completada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              )}

              {/* Breakfast */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="has_breakfast"
                  checked={formData.has_breakfast}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700">
                  Incluye desayuno
                </label>
              </div>

              {/* Additional Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requerimientos Adicionales
                </label>
                <textarea
                  name="additional_requirements"
                  value={formData.additional_requirements}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Ej: Cuna para bebé, cama adicional..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Notas internas..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Info Box */}
              {formData.check_in_date && formData.check_out_date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Duración:</strong> {calculateNights(formData.check_in_date, formData.check_out_date)} noches
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>Total huéspedes:</strong> {parseInt(formData.adults) + parseInt(formData.children) + parseInt(formData.infants)}
                  </p>
                  {formData.has_breakfast && (
                    <p className="text-sm text-blue-800 mt-1">
                      <strong>Desayunos:</strong> {parseInt(formData.adults) + parseInt(formData.children)} por día
                    </p>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : editingReservation ? 'Actualizar' : 'Crear Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
