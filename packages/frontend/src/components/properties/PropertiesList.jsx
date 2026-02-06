import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Home } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import PropertyModal from './PropertyModal';
import ConfirmModal from '../ConfirmModal';

export default function PropertiesList() {
  const [properties, setProperties] = useState([]);
  const [propertyTypes, setPropertyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    property_type_id: '',
    status: ''
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [propertiesRes, typesRes] = await Promise.all([
        api.get('/properties', { params: filters }),
        api.get('/property-types')
      ]);
      setProperties(propertiesRes.data);
      setPropertyTypes(typesRes.data);
    } catch (error) {
      toast.error('Error al cargar propiedades');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedProperty(null);
    setShowModal(true);
  };

  const handleEdit = (property) => {
    setSelectedProperty(property);
    setShowModal(true);
  };

  const handleDelete = (property) => {
    setPropertyToDelete(property);
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!propertyToDelete) return;

    try {
      await api.delete(`/properties/${propertyToDelete.id}`);
      toast.success('Propiedad eliminada correctamente');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar propiedad');
    } finally {
      setPropertyToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedProperty(null);
    loadData();
  };

  const getStatusBadge = (status) => {
    const styles = {
      available: 'bg-green-100 text-green-800',
      occupied: 'bg-blue-100 text-blue-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      cleaning: 'bg-purple-100 text-purple-800',
      reserved: 'bg-orange-100 text-orange-800'
    };

    const labels = {
      available: 'Disponible',
      occupied: 'Ocupado',
      maintenance: 'Mantenimiento',
      cleaning: 'Limpieza',
      reserved: 'Reservado'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Propiedades</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona tus apartamentos, habitaciones y propiedades
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          <Plus size={20} />
          Nueva Propiedad
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <select
            value={filters.property_type_id}
            onChange={(e) => setFilters({ ...filters, property_type_id: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todos los tipos</option>
            {propertyTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="available">Disponible</option>
            <option value="occupied">Ocupado</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="cleaning">Limpieza</option>
            <option value="reserved">Reservado</option>
          </select>
        </div>
      </div>

      {/* Properties List */}
      {properties.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Home className="mx-auto text-gray-400 mb-4" size={64} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay propiedades
          </h3>
          <p className="text-gray-600 mb-4">
            Comienza creando tu primera propiedad
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={20} />
            Nueva Propiedad
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => (
            <div
              key={property.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{property.name}</h3>
                  <p className="text-sm text-gray-600">{property.type_name}</p>
                </div>
                {getStatusBadge(property.status)}
              </div>

              {property.notes && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{property.notes}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  {property.room_count} habitación(es) · {property.total_beds} cama(s)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(property)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(property)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PropertyModal
          property={selectedProperty}
          propertyTypes={propertyTypes}
          onClose={handleCloseModal}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPropertyToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar Propiedad"
        message={`¿Está seguro de eliminar la propiedad "${propertyToDelete?.name}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  );
}
