import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProperties } from '../store/slices/propertiesSlice';
import { fetchReservations, createReservation } from '../store/slices/reservationsSlice';
import { Calendar, Users, Home, Plus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { getTodayInColombia } from '../utils/timezone';

export default function TodayCheckins() {
  const dispatch = useDispatch();
  const { properties } = useSelector((state) => state.properties);
  const { reservations } = useSelector((state) => state.reservations);
  const [showModal, setShowModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [formData, setFormData] = useState({
    check_in_date: getTodayInColombia(),
    check_out_date: '',
    checkin_time: '15:00',
    checkout_time: '12:00',
    adults: 1,
    children: 0,
    infants: 0,
    has_breakfast: false,
    additional_requirements: '',
    notes: ''
  });

  useEffect(() => {
    dispatch(fetchProperties());
    dispatch(fetchReservations());
  }, [dispatch]);

  // Get properties available for today
  const getAvailableProperties = () => {
    const today = getTodayInColombia();

    return properties.filter(p => {
      if (!p.is_active) return false;

      // Check if property has active reservation for today
      const hasReservationToday = reservations.some(r => {
        if (r.status === 'cancelled') return false;
        if (r.property_id !== p.id) return false;

        // Compare dates as strings (YYYY-MM-DD format)
        const rCheckIn = r.check_in_date;
        const rCheckOut = r.check_out_date;

        // Skip past reservations (checkout before today)
        if (rCheckOut < today) return false;

        // Property is occupied if today is between check-in and check-out (exclusive of checkout)
        return (today >= rCheckIn && today < rCheckOut);
      });

      return !hasReservationToday;
    });
  };

  // Get properties with check-in today
  const getTodayCheckIns = () => {
    const today = getTodayInColombia();

    return reservations.filter(r => {
      if (r.status === 'cancelled') return false;
      return r.check_in_date === today;
    });
  };

  const handleStartCheckIn = (property) => {
    setSelectedProperty(property);

    const today = getTodayInColombia();
    const [year, month, day] = today.split('-').map(Number);
    const tomorrowDate = new Date(year, month - 1, day + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    setFormData({
      check_in_date: today,
      check_out_date: tomorrowStr,
      checkin_time: '15:00',
      checkout_time: '12:00',
      adults: 1,
      children: 0,
      infants: 0,
      has_breakfast: false,
      additional_requirements: '',
      notes: ''
    });

    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.check_out_date) {
      toast.error('Debe especificar la fecha de salida');
      return;
    }

    if (new Date(formData.check_out_date) <= new Date(formData.check_in_date)) {
      toast.error('La fecha de salida debe ser posterior a la fecha de entrada');
      return;
    }

    try {
      const data = {
        ...formData,
        property_id: selectedProperty.id
      };

      const result = await dispatch(createReservation(data)).unwrap();
      toast.success(`Check-in creado correctamente. Se generaron ${result.cleaning_tasks_created} tareas de limpieza.`);
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

  const availableProperties = getAvailableProperties();
  const todayCheckIns = getTodayCheckIns();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-ins de Hoy</h1>
        <p className="text-gray-600">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Home className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Propiedades Disponibles</p>
              <p className="text-2xl font-bold text-gray-900">{availableProperties.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Check-ins Programados</p>
              <p className="text-2xl font-bold text-gray-900">{todayCheckIns.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Huéspedes Hoy</p>
              <p className="text-2xl font-bold text-gray-900">
                {todayCheckIns.reduce((sum, r) => sum + r.adults + r.children + r.infants, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Properties */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Propiedades Disponibles</h2>
          <p className="text-sm text-gray-600">Haz click en una propiedad para crear un nuevo check-in</p>
        </div>

        <div className="p-6">
          {availableProperties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay propiedades disponibles en este momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableProperties.map((property) => (
                <div
                  key={property.id}
                  className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => handleStartCheckIn(property)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{property.name}</h3>
                      <p className="text-sm text-gray-600">{property.type_name}</p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Plus className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                      Crear Check-in
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Check-ins programados para hoy */}
      {todayCheckIns.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Check-ins Programados para Hoy</h2>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {todayCheckIns.map((reservation) => (
                <div
                  key={reservation.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Home className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{reservation.property_name}</h4>
                      <p className="text-sm text-gray-600">
                        {reservation.adults + reservation.children + reservation.infants} huésped(es) ·
                        Hora: {reservation.checkin_time || '15:00'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Check-out</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(reservation.check_out_date).toLocaleDateString('es-CO', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal for creating check-in */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Nuevo Check-in</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Propiedad: <span className="font-semibold">{selectedProperty?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Check-in
                  </label>
                  <input
                    type="date"
                    name="check_in_date"
                    value={formData.check_in_date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Check-out *
                  </label>
                  <input
                    type="date"
                    name="check_out_date"
                    value={formData.check_out_date}
                    onChange={handleChange}
                    required
                    min={formData.check_in_date}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Check-in
                  </label>
                  <input
                    type="time"
                    name="checkin_time"
                    value={formData.checkin_time}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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
                </div>
              </div>

              {/* Guests */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adultos *
                  </label>
                  <input
                    type="number"
                    name="adults"
                    value={formData.adults}
                    onChange={handleChange}
                    min="1"
                    required
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
                    Bebés
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

              {/* Breakfast */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="has_breakfast"
                  checked={formData.has_breakfast}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Incluye desayuno
                </label>
              </div>

              {/* Additional Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requerimientos adicionales
                </label>
                <textarea
                  name="additional_requirements"
                  value={formData.additional_requirements}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Cuna, silla alta, etc."
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
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Crear Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
