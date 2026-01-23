import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBreakfastList } from '../store/slices/reservationsSlice';
import { Coffee, Calendar, Users, Printer } from 'lucide-react';
import { getTodayInColombia } from '../utils/timezone';

export default function BreakfastList() {
  const dispatch = useDispatch();
  const { breakfastList, loading } = useSelector((state) => state.reservations);
  const [selectedDate, setSelectedDate] = useState(getTodayInColombia());

  useEffect(() => {
    dispatch(fetchBreakfastList(selectedDate));
  }, [dispatch, selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista de Desayunos</h1>
          <p className="text-sm text-gray-500 mt-1">Control diario de desayunos</p>
        </div>
        <div className="flex space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handlePrint}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Printer className="w-5 h-5 mr-2" />
            Imprimir
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Cargando lista...</p>
        </div>
      ) : breakfastList ? (
        <>
          {/* Print Header */}
          <div className="hidden print:block mb-6">
            <div className="text-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Lista de Desayunos</h1>
              <p className="text-lg text-gray-600">{formatDate(breakfastList.date)}</p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-lg p-6 mb-6 print:bg-white print:text-gray-900 print:border print:border-gray-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Coffee className="w-12 h-12 print:text-orange-600" />
                <div>
                  <p className="text-sm opacity-90 print:text-gray-600">Total de Desayunos</p>
                  <p className="text-4xl font-bold">{breakfastList.total_breakfasts}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90 print:text-gray-600">Fecha</p>
                <p className="text-xl font-semibold print:text-gray-900">{formatDate(breakfastList.date)}</p>
              </div>
            </div>
          </div>

          {/* Reservations Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Propiedad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adultos
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Niños
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Infantes
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-orange-50">
                    <Coffee className="w-4 h-4 inline mr-1" />
                    Desayunos
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {breakfastList.reservations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <Coffee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-lg">No hay desayunos programados para esta fecha</p>
                    </td>
                  </tr>
                ) : (
                  breakfastList.reservations.map((reservation) => (
                    <tr key={reservation.id} className="hover:bg-gray-50 print:hover:bg-white">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {reservation.property_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {reservation.property_type_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-900">{reservation.adults || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-900">{reservation.children || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-500">{reservation.infants || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center bg-orange-50">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-orange-200 text-orange-900">
                          {reservation.breakfast_count}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {breakfastList.reservations.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                      TOTAL:
                    </td>
                    <td className="px-6 py-4 text-center bg-orange-100">
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-orange-300 text-orange-900">
                        <Coffee className="w-5 h-5 mr-2" />
                        {breakfastList.total_breakfasts}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Print Footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
            <div className="text-center text-sm text-gray-500">
              <p>MDCLodging - Sistema de Gestión Hotelera</p>
              <p className="mt-1">Impreso: {new Date().toLocaleString('es-ES')}</p>
            </div>
          </div>
        </>
      ) : null}

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
