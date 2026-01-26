import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReservations, createReservation, updateReservation, deleteReservation } from '../store/slices/reservationsSlice';
import { fetchProperties } from '../store/slices/propertiesSlice';
import { Plus, Calendar, Users, Coffee, Edit, Trash2, X, ArrowUpDown, LogIn, LogOut, Clock, XCircle, Home, Bed, DoorClosed, Sparkles, CheckCircle, Timer, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'react-toastify';
import { getTodayInColombia } from '../utils/timezone';
import api from '../services/api';

export default function Reservations() {
  const dispatch = useDispatch();
  const { reservations, loading } = useSelector((state) => state.reservations);
  const { properties } = useSelector((state) => state.properties);
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [sortColumn, setSortColumn] = useState('check_in_date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Check-in/Check-out modal states
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [checkinType, setCheckinType] = useState('now');
  const [checkoutType, setCheckoutType] = useState('now');
  const [scheduledCheckinTime, setScheduledCheckinTime] = useState('');
  const [scheduledCheckoutTime, setScheduledCheckoutTime] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reservationToDelete, setReservationToDelete] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // 'checkins', 'checkouts', 'stayovers', 'available', 'breakfast', 'housekeeping', 'totalguests', null = all
  const [cleaningTasks, setCleaningTasks] = useState([]);
  const [housekeepingReport, setHousekeepingReport] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [formData, setFormData] = useState({
    property_id: '',
    check_in_date: '',
    check_out_date: '',
    checkin_time: '15:00',
    checkout_time: '12:00',
    adults: 1,
    children: 0,
    infants: 0,
    has_breakfast: false,
    status: 'active',
    reference: '',
    additional_requirements: '',
    notes: ''
  });

  useEffect(() => {
    dispatch(fetchReservations());
    dispatch(fetchProperties());
    fetchCleaningTasks();
    fetchHousekeepingReport(); // Load housekeeping data for the counter
  }, [dispatch]);

  // Refresh housekeeping report when filter becomes active
  useEffect(() => {
    if (activeFilter === 'housekeeping') {
      fetchHousekeepingReport();
    }
  }, [activeFilter]);

  // Update current time every second for elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCleaningTasks = async () => {
    try {
      const response = await api.get('/cleaning-tasks');
      setCleaningTasks(response.data);
    } catch (error) {
      console.error('Error fetching cleaning tasks:', error);
    }
  };

  const fetchHousekeepingReport = async () => {
    try {
      const today = getTodayInColombia();
      // Only show checked_out (checkout reported, waiting to start) and in_progress
      // Do NOT show "pending" (waiting for checkout)
      const response = await api.get(`/reservations/checkout-report?date=${today}&statuses=checked_out,in_progress`);
      setHousekeepingReport(response.data.checkouts || []);
    } catch (error) {
      console.error('Error fetching housekeeping report:', error);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';

    // Handle TIME format (HH:MM, HH:MM:SS, or HH:MM:SS.mmm)
    if (/^\d{2}:\d{2}/.test(timeString) && !timeString.includes('T') && !timeString.includes('Z')) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${period}`;
    }

    return '-';
  };

  const calculateElapsedTime = (checkout) => {
    const { actual_checkout_time, check_out_date, started_at, completed_at } = checkout;

    // No checkout reported yet
    if (!actual_checkout_time) {
      return { time: '-', color: 'text-gray-400' };
    }

    // Checkout reported, waiting to start
    if (actual_checkout_time && !started_at) {
      const colombiaDate = new Date(check_out_date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const checkoutDateTime = new Date(`${colombiaDate}T${actual_checkout_time}`);
      const elapsed = Math.floor((currentTime - checkoutDateTime) / 1000);

      if (elapsed < 0) {
        return { time: '-', color: 'text-gray-400' };
      }

      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;

      let timeStr = '';
      if (hours > 0) timeStr = `${hours}h ${minutes}m`;
      else if (minutes > 0) timeStr = `${minutes}m ${seconds}s`;
      else timeStr = `${seconds}s`;

      return { time: timeStr, color: 'text-orange-700' };
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

      return { time: timeStr, color: 'text-blue-700' };
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

      return { time: timeStr, color: 'text-green-700' };
    }

    return { time: '-', color: 'text-gray-400' };
  };

  const getCleaningStatusBadge = (checkout) => {
    // If pending and no actual_checkout_time, it's waiting for checkout
    if (checkout.cleaning_status === 'pending' && !checkout.actual_checkout_time) {
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
      completed: 'bg-green-100 text-green-800'
    };

    const icons = {
      pending: <AlertCircle className="w-3 h-3" />,
      in_progress: <Loader className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />
    };

    const labels = {
      pending: 'Pend.',
      in_progress: 'Progreso',
      completed: 'Listo'
    };

    if (!checkout.cleaning_status) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-3 h-3" />
          Sin Asig.
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${styles[checkout.cleaning_status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[checkout.cleaning_status]}
        {labels[checkout.cleaning_status] || checkout.cleaning_status}
      </span>
    );
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedReservations = () => {
    const today = getTodayInColombia();

    // Helper to extract date part from ISO string or date string
    const getDatePart = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.split('T')[0];
    };

    // Apply filter first
    let filtered = [...reservations];

    if (activeFilter === 'checkins') {
      // Today's check-ins: show active or checked_in (not cancelled or checked_out)
      filtered = filtered.filter(r =>
        getDatePart(r.check_in_date) === today &&
        ['active', 'checked_in'].includes(r.status)
      );
    } else if (activeFilter === 'checkouts') {
      // Today's check-outs: show active, checked_in, or checked_out (not cancelled)
      filtered = filtered.filter(r =>
        getDatePart(r.check_out_date) === today &&
        ['active', 'checked_in', 'checked_out'].includes(r.status)
      );
    } else if (activeFilter === 'stayovers') {
      // Stayovers: check_in < today && check_out > today
      filtered = filtered.filter(r => {
        return getDatePart(r.check_in_date) < today && getDatePart(r.check_out_date) > today && ['active', 'checked_in'].includes(r.status);
      });
    } else if (activeFilter === 'available') {
      // Available properties - show properties without active guests today
      const occupiedPropertyIds = new Set(
        reservations
          .filter(r => {
            if (!['active', 'checked_in'].includes(r.status)) return false;
            const checkInDate = getDatePart(r.check_in_date);
            const checkOutDate = getDatePart(r.check_out_date);
            // Property is occupied if check-in <= today AND checkout > today
            return checkInDate <= today && checkOutDate > today;
          })
          .map(r => r.property_id)
      );
      filtered = (properties || [])
        .filter(p => p.is_active && !occupiedPropertyIds.has(p.id))
        .map(p => ({
          id: `prop-${p.id}`,
          property_id: p.id,
          property_name: p.name,
          property_type_name: p.type_name,
          status: 'available',
          isPropertyOnly: true
        }));
    } else if (activeFilter === 'totalguests') {
      // Total guests in operation: all checked_in reservations
      filtered = filtered.filter(r => r.status === 'checked_in');
    } else if (activeFilter === 'housekeeping') {
      // Reservations with checked_out status today (in cleaning process)
      filtered = filtered.filter(r => r.status === 'checked_out' && getDatePart(r.check_out_date) === today);
    }

    // Then sort
    const sorted = filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'property_name':
          aValue = a.property_name || '';
          bValue = b.property_name || '';
          break;
        case 'check_in_date':
          aValue = new Date(a.check_in_date || 0);
          bValue = new Date(b.check_in_date || 0);
          break;
        case 'check_out_date':
          aValue = new Date(a.check_out_date || 0);
          bValue = new Date(b.check_out_date || 0);
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
        // Skip cancelled and completed reservations, and the current reservation being edited
        if (!['active', 'checked_in'].includes(r.status)) return false;
        if (editingReservation && r.id === editingReservation.id) return false;
        if (r.property_id !== p.id) return false;

        // Extract date parts for comparison
        const getDatePart = (dateStr) => {
          if (!dateStr) return '';
          return dateStr.split('T')[0];
        };

        const rCheckIn = getDatePart(r.check_in_date);
        const rCheckOut = getDatePart(r.check_out_date);
        const newCheckIn = formData.check_in_date;
        const newCheckOut = formData.check_out_date;

        // Allow same-day turnover: property is available if existing checkout <= new checkin
        // Only overlap if new checkin is before existing checkout
        return newCheckIn < rCheckOut && newCheckOut > rCheckIn;
      });

      return !hasOverlap;
    });
  };

  const handleDelete = (reservation) => {
    setReservationToDelete(reservation);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!reservationToDelete) return;
    try {
      await dispatch(deleteReservation(reservationToDelete.id)).unwrap();
      toast.success('Reserva cancelada correctamente');
      setShowDeleteModal(false);
      setReservationToDelete(null);
      dispatch(fetchReservations());
      fetchCleaningTasks();
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleReportCheckin = (reservation) => {
    setSelectedReservation(reservation);
    setCheckinType('now');
    setScheduledCheckinTime('');
    setShowCheckinModal(true);
  };

  const handleReportCheckout = (reservation) => {
    setSelectedReservation(reservation);
    setCheckoutType('now');
    setScheduledCheckoutTime('');
    setIsPriority(false);
    setShowCheckoutModal(true);
  };

  const confirmCheckin = async () => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;

      const actualTime = checkinType === 'now' ? currentTime : scheduledCheckinTime;

      if (checkinType === 'scheduled' && !scheduledCheckinTime) {
        toast.error('Por favor especifica la hora de entrada');
        return;
      }

      await dispatch(updateReservation({
        id: selectedReservation.id,
        data: {
          actual_checkin_time: actualTime,
          status: 'checked_in'
        }
      })).unwrap();

      toast.success('Check-in reportado correctamente');
      setShowCheckinModal(false);
      setSelectedReservation(null);
      dispatch(fetchReservations());
    } catch (error) {
      toast.error('Error al reportar check-in');
    }
  };

  const confirmCheckout = async () => {
    try {
      const now = new Date();

      let actualCheckoutTime;
      if (checkoutType === 'now') {
        // Use current Colombia time in HH:MM:SS format
        const colombiaTimeString = now.toLocaleString('en-US', {
          timeZone: 'America/Bogota',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        // Extract time part (format: "M/D/YYYY, HH:MM:SS" -> "HH:MM:SS")
        const timePart = colombiaTimeString.split(', ')[1];
        actualCheckoutTime = timePart;
      } else {
        // Scheduled checkout - use selected time
        if (!scheduledCheckoutTime) {
          toast.error('Por favor especifica la hora de salida');
          return;
        }
        actualCheckoutTime = `${scheduledCheckoutTime}:00`;
      }

      await dispatch(updateReservation({
        id: selectedReservation.id,
        data: {
          actual_checkout_time: actualCheckoutTime,
          status: 'checked_out',
          is_priority: isPriority
        }
      })).unwrap();

      const priorityMsg = isPriority ? ' [PRIORIDAD]' : '';
      toast.success(`Check-out reportado correctamente${priorityMsg}. Notificación enviada a housekeeping.`);
      setShowCheckoutModal(false);
      setSelectedReservation(null);
      setIsPriority(false);
      dispatch(fetchReservations());
      fetchCleaningTasks();
    } catch (error) {
      toast.error('Error al reportar check-out');
    }
  };

  const handleCancelCheckout = async () => {
    try {
      await dispatch(updateReservation({
        id: selectedReservation.id,
        data: {
          actual_checkout_time: null,
          status: 'checked_in'
        }
      })).unwrap();

      toast.success('Check-out cancelado correctamente');
      setShowCheckoutModal(false);
      setSelectedReservation(null);
      dispatch(fetchReservations());
      fetchCleaningTasks();
    } catch (error) {
      toast.error('Error al cancelar check-out');
    }
  };

  const handleEdit = (reservation) => {
    setEditingReservation(reservation);
    setFormData({
      property_id: reservation.property_id,
      reference: reservation.reference || '',
      check_in_date: reservation.check_in_date ? reservation.check_in_date.split('T')[0] : '',
      check_out_date: reservation.check_out_date ? reservation.check_out_date.split('T')[0] : '',
      checkin_time: reservation.checkin_time || '15:00',
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
    const today = getTodayInColombia();

    // Calculate tomorrow in Colombia timezone
    const [year, month, day] = today.split('-').map(Number);
    const tomorrowDate = new Date(year, month - 1, day + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    setFormData({
      property_id: '',
      check_in_date: today,
      check_out_date: tomorrowStr,
      checkin_time: '15:00',
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
      fetchCleaningTasks();
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
      checked_in: 'bg-blue-100 text-blue-800',
      checked_out: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Activa',
      checked_in: 'Checked In',
      checked_out: 'Checked Out',
      cancelled: 'Cancelada',
      no_show: 'No Show'
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

  const calculateStats = () => {
    const today = getTodayInColombia();

    // Helper to extract date part from ISO string or date string
    const getDatePart = (dateStr) => {
      if (!dateStr) return '';
      return dateStr.split('T')[0];
    };

    // Check-ins today
    const checkinsTotal = reservations.filter(r =>
      getDatePart(r.check_in_date) === today &&
      ['active', 'checked_in'].includes(r.status)
    ).length;
    const checkinsCompleted = reservations.filter(r =>
      getDatePart(r.check_in_date) === today &&
      r.status === 'checked_in'
    ).length;
    const checkins = { total: checkinsTotal, completed: checkinsCompleted };

    // Total guests in operation: all checked_in guests (already in the property)
    const totalGuests = reservations
      .filter(r => r.status === 'checked_in')
      .reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0) + (r.infants || 0), 0);

    // Check-outs today
    const checkoutsTotal = reservations.filter(r =>
      getDatePart(r.check_out_date) === today &&
      ['active', 'checked_in', 'checked_out'].includes(r.status)
    ).length;
    const checkoutsCompleted = reservations.filter(r =>
      getDatePart(r.check_out_date) === today &&
      r.status === 'checked_out'
    ).length;
    const checkouts = { total: checkoutsTotal, completed: checkoutsCompleted };

    // Stayovers: check_in < today && check_out > today
    const stayovers = reservations.filter(r => {
      return getDatePart(r.check_in_date) < today && getDatePart(r.check_out_date) > today && ['active', 'checked_in'].includes(r.status);
    }).length;

    // Available properties (exclude properties with active guests today)
    const occupiedPropertyIds = new Set(
      reservations
        .filter(r => {
          if (!['active', 'checked_in'].includes(r.status)) return false;
          const checkInDate = getDatePart(r.check_in_date);
          const checkOutDate = getDatePart(r.check_out_date);
          // Property is occupied if check-in <= today AND checkout > today
          return checkInDate <= today && checkOutDate > today;
        })
        .map(r => r.property_id)
    );
    const available = properties.filter(p => p.is_active && !occupiedPropertyIds.has(p.id)).length;

    // Breakfasts (guests with breakfast and checked_in status only)
    const breakfasts = reservations
      .filter(r => r.has_breakfast && r.status === 'checked_in')
      .reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0);

    // Housekeeping (count from housekeepingReport which only includes checked_out and in_progress)
    const housekeeping = housekeepingReport.length;

    return { checkins, totalGuests, checkouts, stayovers, available, breakfasts, housekeeping };
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
  const stats = calculateStats();

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
          Nueva Reserva
        </button>
      </div>

      {/* Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {/* Check-ins */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'checkins' ? null : 'checkins')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'checkins'
              ? 'border-green-500 ring-2 ring-green-200'
              : 'border-gray-200 hover:border-green-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <LogIn className={`w-8 h-8 ${activeFilter === 'checkins' ? 'text-green-600' : 'text-green-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.checkins.completed}/{stats.checkins.total}
          </p>
          <p className="text-xs text-gray-500">Check-ins</p>
        </button>

        {/* Check-outs */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'checkouts' ? null : 'checkouts')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'checkouts'
              ? 'border-orange-500 ring-2 ring-orange-200'
              : 'border-gray-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <LogOut className={`w-8 h-8 ${activeFilter === 'checkouts' ? 'text-orange-600' : 'text-orange-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.checkouts.completed}/{stats.checkouts.total}
          </p>
          <p className="text-xs text-gray-500">Check-outs</p>
        </button>

        {/* Stayovers */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'stayovers' ? null : 'stayovers')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'stayovers'
              ? 'border-purple-500 ring-2 ring-purple-200'
              : 'border-gray-200 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Bed className={`w-8 h-8 ${activeFilter === 'stayovers' ? 'text-purple-600' : 'text-purple-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.stayovers}</p>
          <p className="text-xs text-gray-500">Stayovers</p>
        </button>

        {/* Available */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'available' ? null : 'available')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'available'
              ? 'border-gray-500 ring-2 ring-gray-200'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Home className={`w-8 h-8 ${activeFilter === 'available' ? 'text-gray-700' : 'text-gray-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.available}</p>
          <p className="text-xs text-gray-500">Disponibles</p>
        </button>

        {/* Total Guests */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'totalguests' ? null : 'totalguests')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'totalguests'
              ? 'border-blue-500 ring-2 ring-blue-200'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Users className={`w-8 h-8 ${activeFilter === 'totalguests' ? 'text-blue-600' : 'text-blue-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalGuests}</p>
          <p className="text-xs text-gray-500">Total Huéspedes</p>
        </button>

        {/* Housekeeping */}
        <button
          onClick={() => setActiveFilter(activeFilter === 'housekeeping' ? null : 'housekeeping')}
          className={`bg-white p-4 rounded-lg shadow border-2 transition-all text-left ${
            activeFilter === 'housekeeping'
              ? 'border-teal-500 ring-2 ring-teal-200'
              : 'border-gray-200 hover:border-teal-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Sparkles className={`w-8 h-8 ${activeFilter === 'housekeeping' ? 'text-teal-600' : 'text-teal-500'}`} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.housekeeping}</p>
          <p className="text-xs text-gray-500">Housekeeping</p>
        </button>
      </div>

      {/* Reservations Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <SortableHeader column="property_name">Propiedad</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
              {activeFilter === 'housekeeping' ? (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">H. Prog.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">H. Report.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asignado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
                </>
              ) : (
                <>
                  <SortableHeader column="check_in_date">Check-in</SortableHeader>
                  <SortableHeader column="check_out_date">Check-out</SortableHeader>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Noches</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Huéspedes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Desayuno</th>
                  <SortableHeader column="status">Estado</SortableHeader>
                  {activeFilter !== 'totalguests' && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="10" className="px-6 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : sortedReservations.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-6 py-4 text-center text-gray-500">
                  No hay reservas registradas
                </td>
              </tr>
            ) : (
              (activeFilter === 'housekeeping' ? housekeepingReport : sortedReservations).map((reservation) => {
                // For housekeeping filter, render checkout report format
                if (activeFilter === 'housekeeping') {
                  const timeData = calculateElapsedTime(reservation);
                  return (
                    <tr key={reservation.id} className={reservation.actual_checkout_time ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                      <td className="px-2 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-700">#{reservation.id}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-sm text-gray-900">{reservation.property_name}</div>
                          <div className="text-xs text-gray-500">{reservation.property_type_name}</div>
                        </div>
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                        {reservation.reference || '-'}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                        {reservation.cleaning_task_type === 'check_out' ? 'Aseo General' :
                         reservation.cleaning_task_type === 'stay_over' ? 'Aseo Liviano' :
                         reservation.cleaning_task_type === 'deep_cleaning' ? 'Aseo Profundo' :
                         reservation.cleaning_task_type || '-'}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {(reservation.actual_checkout_time || reservation.checkout_time) ? (
                          <div className={`flex items-center gap-1 text-xs ${reservation.actual_checkout_time ? 'text-orange-700 font-medium' : 'text-gray-700'}`}>
                            <Clock className="w-3 h-3" />
                            {formatTime(reservation.actual_checkout_time || reservation.checkout_time)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {reservation.started_at ? (
                          <div className="flex items-center gap-1 text-xs text-green-700 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            {formatTime(reservation.started_at)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {getCleaningStatusBadge(reservation)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                        {reservation.assigned_to_name || '-'}
                      </td>
                      <td className="px-2 py-3 whitespace-nowrap">
                        {timeData.time !== '-' ? (
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            <span className={`text-xs font-mono ${timeData.color}`}>
                              {timeData.time}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                }

                // Handle available properties display (no reservation data)
                if (reservation.isPropertyOnly) {
                  return (
                    <tr key={reservation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-700">-</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{reservation.property_name}</div>
                        <div className="text-xs text-gray-500">{reservation.property_type_name}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500" colSpan="6">
                        <span className="italic">Sin reserva activa</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Disponible
                        </span>
                      </td>
                      {activeFilter !== 'totalguests' && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCreate()}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Crear Reserva"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                }

                // Normal reservation display
                return (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">
                      #{reservation.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{reservation.property_name}</div>
                      <div className="text-xs text-gray-500">{reservation.property_type_name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {reservation.reference || '-'}
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
                    {activeFilter !== 'totalguests' && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Check-in button - only show for active reservations on or before check-in date */}
                          {reservation.status === 'active' && (() => {
                            const today = getTodayInColombia();
                            const checkInDate = reservation.check_in_date.split('T')[0];
                            // Only show check-in button if check-in date is today or in the past
                            return checkInDate <= today;
                          })() && (
                            <button
                              onClick={() => handleReportCheckin(reservation)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reportar Check-in"
                            >
                              <LogIn className="w-5 h-5" />
                            </button>
                          )}

                          {/* Check-out button - only show for checked_in reservations */}
                          {reservation.status === 'checked_in' && (
                            <button
                              onClick={() => handleReportCheckout(reservation)}
                              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                              title="Reportar Check-out"
                            >
                              <LogOut className="w-5 h-5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleEdit(reservation)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(reservation)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
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
                {editingReservation ? 'Editar Reserva' : 'Nueva Reserva'}
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

              {/* Check-in and Check-out Times */}
              <div className="grid grid-cols-2 gap-4">
                {/* Checkin Time */}
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
                  <p className="text-xs text-gray-500 mt-1">
                    Hora estimada de llegada del huésped
                  </p>
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

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia
                </label>
                <input
                  type="text"
                  name="reference"
                  value={formData.reference}
                  onChange={handleChange}
                  placeholder="Nombre del huésped, número de reserva, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identificación de la reserva (nombre del huésped, número de confirmación, etc.)
                </p>
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
                    <option value="checked_in">Checked In</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="no_show">No Show</option>
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
                  {loading ? 'Guardando...' : editingReservation ? 'Actualizar' : 'Crear Reserva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {showCheckinModal && selectedReservation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCheckinModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Reportar Check-in</h2>
                <button onClick={() => setShowCheckinModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {selectedReservation.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Check-in programado:</span> {selectedReservation.checkin_time || 'No especificado'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Huéspedes:</span> {selectedReservation.adults + (selectedReservation.children || 0) + (selectedReservation.infants || 0)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ¿Cuándo entra el huésped?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="checkinType"
                        value="now"
                        checked={checkinType === 'now'}
                        onChange={(e) => setCheckinType(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Check-in Inmediato</div>
                        <div className="text-sm text-gray-500">El huésped ya entró o está entrando ahora</div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="checkinType"
                        value="scheduled"
                        checked={checkinType === 'scheduled'}
                        onChange={(e) => setCheckinType(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Check-in Programado</div>
                        <div className="text-sm text-gray-500">El huésped entrará a una hora específica</div>
                      </div>
                    </label>
                  </div>
                </div>

                {checkinType === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de entrada
                    </label>
                    <input
                      type="time"
                      value={scheduledCheckinTime}
                      onChange={(e) => setScheduledCheckinTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowCheckinModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmCheckin}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Confirmar Check-in
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {showCheckoutModal && selectedReservation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowCheckoutModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Reportar Check-out</h2>
                <button onClick={() => setShowCheckoutModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {selectedReservation.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Check-out programado:</span> {selectedReservation.checkout_time || 'No especificado'}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Huéspedes:</span> {selectedReservation.adults + (selectedReservation.children || 0) + (selectedReservation.infants || 0)}
                  </p>
                </div>

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
                        <div className="font-medium text-gray-900">Check-out Inmediato</div>
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
                        <div className="font-medium text-gray-900">Check-out Programado</div>
                        <div className="text-sm text-gray-500">El huésped saldrá a una hora específica</div>
                      </div>
                    </label>
                  </div>
                </div>

                {checkoutType === 'scheduled' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de salida
                    </label>
                    <input
                      type="time"
                      value={scheduledCheckoutTime}
                      onChange={(e) => setScheduledCheckoutTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
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
                {/* Cancel Checkout Button - only show if checkout already reported */}
                {selectedReservation?.actual_checkout_time ? (
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
                    onClick={confirmCheckout}
                    disabled={checkoutType === 'scheduled' && !scheduledCheckoutTime}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    {selectedReservation?.actual_checkout_time ? 'Actualizar' : 'Confirmar'} Check-out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && reservationToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowDeleteModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Confirmar Cancelación</h2>
                <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Propiedad:</span> {reservationToDelete.property_name}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Check-in:</span> {new Date(reservationToDelete.check_in_date).toLocaleDateString('es-ES')}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    <span className="font-semibold">Check-out:</span> {new Date(reservationToDelete.check_out_date).toLocaleDateString('es-ES')}
                  </p>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Atención:</strong> Esta acción cancelará la reserva y las tareas de limpieza asociadas.
                  </p>
                </div>

                <p className="text-gray-700">
                  ¿Estás seguro de que deseas cancelar esta reserva?
                </p>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  No, mantener
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Sí, cancelar reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
