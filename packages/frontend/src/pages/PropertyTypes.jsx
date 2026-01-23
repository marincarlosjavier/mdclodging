import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPropertyTypes, deletePropertyType } from '../store/slices/propertyTypesSlice';
import { Plus, Search, Building2, Bed, Home, Edit, Trash2, Eye, MapPin, Bath, Armchair, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';
import PropertyTypeModal from '../components/propertyTypes/PropertyTypeModal';
import { propertiesAPI } from '../services/api';

export default function PropertyTypes() {
  const dispatch = useDispatch();
  const { types, loading } = useSelector((state) => state.propertyTypes);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    dispatch(fetchPropertyTypes());
  }, [dispatch]);

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este tipo de propiedad?')) return;
    try {
      await dispatch(deletePropertyType(id)).unwrap();
      toast.success('Tipo de propiedad eliminado correctamente');
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingType(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingType(null);
    dispatch(fetchPropertyTypes());
  };

  const handleGenerateProperties = async (typeId, typeName) => {
    if (!confirm(`¿Generar propiedades para "${typeName}"?\n\nEsto creará las unidades individuales basadas en la nomenclatura configurada.`)) return;

    try {
      const response = await propertiesAPI.generateFromType(typeId);
      toast.success(`${response.data.created} propiedades generadas correctamente${response.data.skipped > 0 ? ` (${response.data.skipped} ya existían)` : ''}`);
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const filteredTypes = types.filter((type) => {
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || type.property_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'hotel_room':
        return <Bed className="text-blue-600" size={24} />;
      case 'apartment':
        return <Building2 className="text-green-600" size={24} />;
      case 'house':
        return <Home className="text-orange-600" size={24} />;
      case 'suite':
        return <Building2 className="text-purple-600" size={24} />;
      default:
        return <Building2 className="text-gray-600" size={24} />;
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      hotel_room: 'Habitación Hotel',
      apartment: 'Apartamento',
      house: 'Casa',
      suite: 'Suite',
      other: 'Otro'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      hotel_room: 'bg-blue-100 text-blue-800',
      apartment: 'bg-green-100 text-green-800',
      house: 'bg-orange-100 text-orange-800',
      suite: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.other;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tipos de Propiedades</h1>
        <p className="text-gray-600">
          Gestiona los tipos de apartamentos, habitaciones y casas
        </p>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar tipos de propiedad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todas las categorías</option>
            <option value="hotel_room">Habitación Hotel</option>
            <option value="apartment">Apartamento</option>
            <option value="house">Casa</option>
            <option value="suite">Suite</option>
            <option value="other">Otro</option>
          </select>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition whitespace-nowrap"
          >
            <Plus size={20} />
            Nuevo Tipo
          </button>
        </div>
      </div>

      {/* Property Types Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600 mb-4">No hay tipos de propiedad registrados</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={20} />
            Crear Primer Tipo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTypes.map((type) => (
            <div
              key={type.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {getCategoryIcon(type.property_category)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{type.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getCategoryColor(type.property_category)}`}>
                      {getCategoryLabel(type.property_category)}
                    </span>
                  </div>
                </div>
              </div>

              {type.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{type.description}</p>
              )}

              {(type.city || type.department || type.zone) && (
                <div className="flex items-start gap-2 mb-3 text-sm text-gray-600">
                  <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    {type.zone && <span className="font-medium">{type.zone}</span>}
                    {(type.city || type.department) && (
                      <span className="text-gray-500">
                        {type.zone && ' - '}
                        {type.city}{type.city && type.department && ', '}{type.department}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {/* Bedrooms and Beds */}
                <div className="flex items-start gap-2 text-sm">
                  <Bed size={16} className="mt-0.5 flex-shrink-0 text-gray-600" />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{type.total_bedrooms || 0}</span>
                    <span className="text-gray-600"> habitacion{type.total_bedrooms !== 1 ? 'es' : ''}</span>
                    {type.total_beds > 0 && (
                      <span className="text-gray-500">
                        {' • '}
                        {type.total_beds} cama{type.total_beds !== 1 ? 's' : ''}
                        {' ('}
                        {[
                          type.total_single_beds > 0 && `${type.total_single_beds} individual${type.total_single_beds !== 1 ? 'es' : ''}`,
                          type.total_double_beds > 0 && `${type.total_double_beds} doble${type.total_double_beds !== 1 ? 's' : ''}`,
                          type.total_queen_beds > 0 && `${type.total_queen_beds} queen`,
                          type.total_king_beds > 0 && `${type.total_king_beds} king`,
                          type.total_sofa_beds > 0 && `${type.total_sofa_beds} sofá cama`
                        ].filter(Boolean).join(', ')}
                        {')'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bathrooms */}
                {type.total_bathrooms > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bath size={16} className="flex-shrink-0 text-gray-600" />
                    <span className="font-medium text-gray-900">{type.total_bathrooms}</span>
                    <span className="text-gray-600">baño{type.total_bathrooms !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Spaces */}
                {type.space_types && (
                  <div className="flex items-start gap-2 text-sm">
                    <Armchair size={16} className="mt-0.5 flex-shrink-0 text-gray-600" />
                    <div className="flex-1">
                      <span className="text-gray-600">
                        {type.space_types.split(', ').map(space => {
                          const labels = {
                            kitchen: 'Cocina',
                            living_room: 'Sala',
                            dining_room: 'Comedor',
                            terrace: 'Terraza',
                            balcony: 'Balcón',
                            laundry: 'Lavandería',
                            other: 'Otro'
                          };
                          return labels[space] || space;
                        }).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleGenerateProperties(type.id, type.name)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition font-medium"
                >
                  <Sparkles size={16} />
                  Generar Propiedades
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(type)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition"
                  >
                    <Edit size={16} />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(type.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
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
        <PropertyTypeModal
          type={editingType}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
