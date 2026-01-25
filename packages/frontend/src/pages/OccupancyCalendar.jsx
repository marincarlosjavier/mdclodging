import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProperties } from '../store/slices/propertiesSlice';
import { fetchReservations, createReservation, updateReservation } from '../store/slices/reservationsSlice';
import { ChevronLeft, ChevronRight, Calendar, Users, Coffee, X, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { getTodayInColombia } from '../utils/timezone';

export default function OccupancyCalendar() {
  const dispatch = useDispatch();
  const { properties } = useSelector((state) => state.properties);
  const { reservations } = useSelector((state) => state.reservations);
  const [startDate, setStartDate] = useState(getTodayInColombia());
  const [daysToShow, setDaysToShow] = useState(30);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newReservation, setNewReservation] = useState(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    dispatch(fetchProperties());
    dispatch(fetchReservations());
  }, [dispatch]);

  // Generate date range
  const generateDateRange = () => {
    const dates = [];
    const start = new Date(startDate);

    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const dates = generateDateRange();

  // Navigate calendar
  const navigateCalendar = (direction) => {
    const current = new Date(startDate);
    current.setDate(current.getDate() + (direction === 'next' ? daysToShow : -daysToShow));
    setStartDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setStartDate(getTodayInColombia());
  };

  // Get reservations for a property
  const getPropertyReservations = (propertyId) => {
    return reservations.filter(r =>
      r.property_id === propertyId && r.status !== 'cancelled'
    );
  };

  // Calculate position and width for reservation bar
  const getReservationStyle = (reservation) => {
    const checkIn = new Date(reservation.check_in_date);
    const checkOut = new Date(reservation.check_out_date);
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + daysToShow);

    // Check if reservation is in visible range
    if (checkOut < start || checkIn > end) {
      return null;
    }

    // Check-in starts at 15% of check-in day, ends at 27% of check-out day
    const checkInOffset = 0.15;
    const checkOutOffset = 0.27;

    // Calculate start position (days from startDate)
    const visibleCheckIn = checkIn < start ? start : checkIn;
    const visibleCheckOut = checkOut > end ? end : checkOut;

    let startPosition = 0;
    if (visibleCheckIn > start) {
      startPosition = (visibleCheckIn - start) / (1000 * 60 * 60 * 24) + checkInOffset;
    } else if (checkIn < start) {
      // Reservation started before visible range
      startPosition = 0;
    }

    // Calculate end position
    let endPosition = (visibleCheckOut - start) / (1000 * 60 * 60 * 24);
    if (checkOut <= end) {
      // Add time offset only if checkout is visible
      endPosition += checkOutOffset;
    } else {
      // Extends beyond visible range
      endPosition = daysToShow;
    }

    // Calculate width
    const width = endPosition - startPosition;

    // Calculate percentages
    const leftPercent = (startPosition / daysToShow) * 100;
    const widthPercent = (width / daysToShow) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`
    };
  };

  // Get reservation color based on status and dates
  const getReservationColor = (reservation) => {
    const today = getTodayInColombia();
    // Extract date part from ISO string or date string
    const getDatePart = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.split('T')[0];
    };
    const checkIn = getDatePart(reservation.check_in_date);
    const checkOut = getDatePart(reservation.check_out_date);

    if (checkOut === today) {
      return 'bg-red-500 hover:bg-red-600'; // Checkout today
    } else if (checkIn === today) {
      return 'bg-orange-500 hover:bg-orange-600'; // Checkin today
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      if (checkIn === tomorrowStr) {
        return 'bg-blue-500 hover:bg-blue-600'; // Checkin tomorrow
      }
    }

    return 'bg-green-600 hover:bg-green-700'; // Active
  };

  // Handle click on reservation bar
  const handleReservationClick = (reservation, e) => {
    e.stopPropagation();
    setSelectedReservation(reservation);
    setShowModal(true);
  };

  // Handle click on empty cell to create reservation
  const handleCellClick = (propertyId, dateIndex) => {
    const date = dates[dateIndex];
    const dateStr = date.toISOString().split('T')[0];

    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];

    setNewReservation({
      property_id: propertyId,
      check_in_date: dateStr,
      check_out_date: nextDayStr,
      checkin_time: '15:00',
      checkout_time: '12:00',
      adults: 1,
      children: 0,
      infants: 0,
      has_breakfast: false,
      additional_requirements: '',
      notes: ''
    });
    setSelectedReservation(null);
    setShowModal(true);
  };

  // Format date header
  const formatDateHeader = (date) => {
    const day = date.getDate();
    const weekday = date.toLocaleDateString('es-CO', { weekday: 'short' });
    return { day, weekday };
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date(getTodayInColombia());
    return date.toDateString() === today.toDateString();
  };

  // Check if date is weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Create new reservation
  const handleCreateReservation = async () => {
    try {
      const result = await dispatch(createReservation(newReservation)).unwrap();
      toast.success(`Reserva creada. Se generaron ${result.cleaning_tasks_created} tareas de limpieza.`);
      setShowModal(false);
      setNewReservation(null);
      dispatch(fetchReservations());
    } catch (error) {
      // Error already handled
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewReservation(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const activeProperties = properties.filter(p => p.is_active);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario de Ocupación</h1>
          <p className="text-gray-600">Vista general de todas las reservas</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Hoy
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateCalendar('prev')}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ChevronLeft size={20} />
            </button>

            <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium">
              {new Date(startDate).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </span>

            <button
              onClick={() => navigateCalendar('next')}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <select
            value={daysToShow}
            onChange={(e) => setDaysToShow(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg"
          >
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-green-600 rounded"></div>
            <span>Activa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-orange-500 rounded"></div>
            <span>Check-in hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-red-500 rounded"></div>
            <span>Check-out hoy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-blue-500 rounded"></div>
            <span>Check-in mañana</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div ref={calendarRef} className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header with dates */}
            <div className="flex border-b border-gray-200">
              <div className="sticky left-0 z-20 w-40 bg-gray-50 border-r border-gray-200 p-3 font-semibold">
                Propiedad
              </div>
              <div className="flex flex-1">
                {dates.map((date, idx) => {
                  const { day, weekday } = formatDateHeader(date);
                  const today = isToday(date);
                  const weekend = isWeekend(date);

                  return (
                    <div
                      key={idx}
                      className={`flex-1 min-w-[50px] p-2 text-center border-r border-gray-200 ${
                        today ? 'bg-blue-50' : weekend ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <div className={`text-xs ${today ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                        {weekday}
                      </div>
                      <div className={`text-sm font-semibold ${today ? 'text-blue-600' : 'text-gray-900'}`}>
                        {day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Property rows */}
            {activeProperties.map((property) => {
              const propertyReservations = getPropertyReservations(property.id);

              return (
                <div key={property.id} className="flex border-b border-gray-200 hover:bg-gray-50">
                  {/* Property name */}
                  <div className="sticky left-0 z-10 w-40 bg-white border-r border-gray-200 p-3">
                    <div className="font-semibold text-gray-900">{property.name}</div>
                    <div className="text-xs text-gray-500">{property.type_name}</div>
                  </div>

                  {/* Calendar grid */}
                  <div className="flex-1 relative min-h-[60px]">
                    <div className="absolute inset-0 flex">
                      {dates.map((date, idx) => {
                        const weekend = isWeekend(date);
                        const today = isToday(date);

                        return (
                          <div
                            key={idx}
                            className={`flex-1 min-w-[50px] border-r border-gray-200 cursor-pointer ${
                              today ? 'bg-blue-50' : weekend ? 'bg-gray-50' : ''
                            }`}
                            onClick={() => handleCellClick(property.id, idx)}
                          />
                        );
                      })}
                    </div>

                    {/* Reservation bars */}
                    <div className="absolute inset-0 pointer-events-none">
                      {propertyReservations.map((reservation) => {
                        const style = getReservationStyle(reservation);
                        if (!style) return null;

                        const color = getReservationColor(reservation);

                        return (
                          <div
                            key={reservation.id}
                            className={`absolute ${color} text-white text-xs rounded px-2 py-0.5 cursor-pointer pointer-events-auto shadow-md flex items-center justify-between overflow-hidden`}
                            style={{
                              ...style,
                              top: '25%',
                              bottom: '25%'
                            }}
                            onClick={(e) => handleReservationClick(reservation, e)}
                            title={`${reservation.adults + reservation.children + reservation.infants} huéspedes`}
                          >
                            <div className="flex items-center gap-1 truncate">
                              <Users size={12} />
                              <span className="font-medium">{reservation.adults + reservation.children + reservation.infants}</span>
                              {reservation.has_breakfast && <Coffee size={12} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal for reservation details or creation */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedReservation ? 'Detalles de Reserva' : 'Nueva Reserva'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedReservation(null);
                  setNewReservation(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {selectedReservation ? (
                // Show reservation details
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Propiedad</label>
                      <p className="font-semibold">{selectedReservation.property_name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Estado</label>
                      <p className="font-semibold capitalize">{selectedReservation.status}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Check-in</label>
                      <p className="font-semibold">
                        {new Date(selectedReservation.check_in_date).toLocaleDateString('es-CO')}
                        {selectedReservation.checkin_time && ` - ${selectedReservation.checkin_time}`}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Check-out</label>
                      <p className="font-semibold">
                        {new Date(selectedReservation.check_out_date).toLocaleDateString('es-CO')}
                        {selectedReservation.checkout_time && ` - ${selectedReservation.checkout_time}`}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Huéspedes</label>
                      <p className="font-semibold">
                        {selectedReservation.adults} adultos, {selectedReservation.children} niños, {selectedReservation.infants} bebés
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Desayuno</label>
                      <p className="font-semibold">{selectedReservation.has_breakfast ? 'Sí' : 'No'}</p>
                    </div>
                  </div>

                  {selectedReservation.additional_requirements && (
                    <div>
                      <label className="text-sm text-gray-600">Requerimientos adicionales</label>
                      <p className="text-gray-900">{selectedReservation.additional_requirements}</p>
                    </div>
                  )}

                  {selectedReservation.notes && (
                    <div>
                      <label className="text-sm text-gray-600">Notas</label>
                      <p className="text-gray-900">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                // Show new reservation form
                <form onSubmit={(e) => { e.preventDefault(); handleCreateReservation(); }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Propiedad</label>
                      <select
                        name="property_id"
                        value={newReservation.property_id}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {properties.filter(p => p.is_active).map(p => (
                          <option key={p.id} value={p.id}>{p.name} - {p.type_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adultos</label>
                      <input
                        type="number"
                        name="adults"
                        value={newReservation.adults}
                        onChange={handleChange}
                        min="1"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                      <input
                        type="date"
                        name="check_in_date"
                        value={newReservation.check_in_date}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                      <input
                        type="date"
                        name="check_out_date"
                        value={newReservation.check_out_date}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Niños</label>
                      <input
                        type="number"
                        name="children"
                        value={newReservation.children}
                        onChange={handleChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bebés</label>
                      <input
                        type="number"
                        name="infants"
                        value={newReservation.infants}
                        onChange={handleChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="has_breakfast"
                      checked={newReservation.has_breakfast}
                      onChange={handleChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                    <label className="ml-2 text-sm text-gray-700">Incluye desayuno</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                      name="notes"
                      value={newReservation.notes}
                      onChange={handleChange}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        setNewReservation(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Crear Reserva
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
