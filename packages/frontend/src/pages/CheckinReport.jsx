import { useState, useEffect } from 'react';
import { Calendar, Check, AlertCircle, Users, Coffee, FileText, Home } from 'lucide-react';
import api from '../services/api';
import { getTodayInColombia } from '../utils/timezone';

export default function CheckinReport() {
  const [date, setDate] = useState(getTodayInColombia());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});

  useEffect(() => {
    fetchReport();
  }, [date]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reservations/checkin-report?date=${date}`);
      const checkins = Array.isArray(response.data.checkins) ? response.data.checkins : [];
      setReport({ ...response.data, checkins });

      // Initialize checked items from localStorage
      const savedItems = localStorage.getItem(`checkin-${date}`);
      if (savedItems) {
        setCheckedItems(JSON.parse(savedItems));
      } else {
        setCheckedItems({});
      }
    } catch (error) {
      console.error('Error fetching checkin report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (reservationId, itemKey) => {
    const key = `${reservationId}-${itemKey}`;
    const newCheckedItems = {
      ...checkedItems,
      [key]: !checkedItems[key]
    };
    setCheckedItems(newCheckedItems);

    // Save to localStorage
    localStorage.setItem(`checkin-${date}`, JSON.stringify(newCheckedItems));
  };

  const isItemChecked = (reservationId, itemKey) => {
    const key = `${reservationId}-${itemKey}`;
    return !!checkedItems[key];
  };

  const getCompletionPercentage = (reservationId) => {
    const items = [
      'room_clean',
      'beds_made',
      'towels',
      'toiletries',
      'welcome_kit',
      'keys_ready'
    ];

    const completed = items.filter(item => isItemChecked(reservationId, item)).length;
    return Math.round((completed / items.length) * 100);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preparación de Check-ins</h1>
          <p className="text-gray-600">Lista de llegadas y preparación de habitaciones</p>
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Preparación de Check-ins</h1>
        <p className="text-gray-600">
          Fecha: {new Date(date).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <p className="text-gray-600">Total de llegadas: {report?.total_checkins || 0}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Llegadas</p>
              <p className="text-2xl font-bold text-gray-900">{report?.total_checkins || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkins?.filter(c => getCompletionPercentage(c.id) === 100).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkins?.filter(c => getCompletionPercentage(c.id) < 100).length || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Huéspedes</p>
              <p className="text-2xl font-bold text-gray-900">
                {report?.checkins?.reduce((sum, c) => sum + c.adults + c.children + c.infants, 0) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Check-in Cards */}
      <div className="space-y-4">
        {report?.checkins && report.checkins.length > 0 ? (
          report.checkins.map((checkin) => {
            const totalGuests = checkin.adults + checkin.children + checkin.infants;
            const completionPercentage = getCompletionPercentage(checkin.id);
            const isComplete = completionPercentage === 100;

            return (
              <div
                key={checkin.id}
                className={`bg-white rounded-lg shadow border-2 p-6 print:break-inside-avoid ${
                  isComplete ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Home className="w-5 h-5 text-gray-500" />
                      <h3 className="text-lg font-bold text-gray-900">{checkin.property_name}</h3>
                      {isComplete && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          <Check className="w-3 h-3" />
                          Listo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{checkin.property_type_name}</p>
                  </div>

                  <div className="text-right print:hidden">
                    <div className="text-2xl font-bold text-blue-600">{completionPercentage}%</div>
                    <div className="text-xs text-gray-500">Completado</div>
                  </div>
                </div>

                {/* Guest Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">Total Huéspedes</p>
                    <p className="font-semibold text-gray-900">{totalGuests}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Adultos</p>
                    <p className="font-semibold text-gray-900">{checkin.adults}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Niños</p>
                    <p className="font-semibold text-gray-900">{checkin.children}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Bebés</p>
                    <p className="font-semibold text-gray-900">{checkin.infants}</p>
                  </div>
                </div>

                {/* Desayuno */}
                {checkin.has_breakfast && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="flex items-center gap-2 text-orange-800">
                      <Coffee className="w-4 h-4" />
                      <span className="font-medium">Incluye desayuno ({checkin.adults + checkin.children} personas)</span>
                    </div>
                  </div>
                )}

                {/* Requerimientos Adicionales */}
                {checkin.additional_requirements && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2 text-blue-800">
                      <FileText className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Requerimientos adicionales:</p>
                        <p className="text-sm">{checkin.additional_requirements}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notas */}
                {checkin.notes && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700"><span className="font-medium">Notas:</span> {checkin.notes}</p>
                  </div>
                )}

                {/* Checklist */}
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Lista de Preparación:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <ChecklistItem
                      label="Habitación limpia y lista"
                      checked={isItemChecked(checkin.id, 'room_clean')}
                      onChange={() => handleToggleItem(checkin.id, 'room_clean')}
                    />
                    <ChecklistItem
                      label="Camas tendidas"
                      checked={isItemChecked(checkin.id, 'beds_made')}
                      onChange={() => handleToggleItem(checkin.id, 'beds_made')}
                    />
                    <ChecklistItem
                      label="Toallas preparadas"
                      checked={isItemChecked(checkin.id, 'towels')}
                      onChange={() => handleToggleItem(checkin.id, 'towels')}
                    />
                    <ChecklistItem
                      label="Artículos de baño"
                      checked={isItemChecked(checkin.id, 'toiletries')}
                      onChange={() => handleToggleItem(checkin.id, 'toiletries')}
                    />
                    <ChecklistItem
                      label="Kit de bienvenida"
                      checked={isItemChecked(checkin.id, 'welcome_kit')}
                      onChange={() => handleToggleItem(checkin.id, 'welcome_kit')}
                    />
                    <ChecklistItem
                      label="Llaves listas"
                      checked={isItemChecked(checkin.id, 'keys_ready')}
                      onChange={() => handleToggleItem(checkin.id, 'keys_ready')}
                    />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No hay check-ins programados para esta fecha</p>
          </div>
        )}
      </div>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-gray-200 text-sm text-gray-600">
        <p>Impreso el {new Date().toLocaleString('es-CO')}</p>
        <p>MDCLodging - Sistema de Gestión Hotelera</p>
      </div>
    </div>
  );
}

function ChecklistItem({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 print:border-gray-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 print:appearance-none print:border-2 print:border-gray-600"
      />
      <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
        {label}
      </span>
      {checked && <Check className="w-4 h-4 text-green-600 ml-auto print:hidden" />}
    </label>
  );
}
