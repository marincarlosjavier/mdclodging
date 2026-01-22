import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCatalogItems, createCatalogItem, updateCatalogItem, deleteCatalogItem } from '../store/slices/catalogSlice';
import { Plus, Search, MapPin, UtensilsCrossed, Sofa, Bed, Trash2, Edit } from 'lucide-react';
import { toast } from 'react-toastify';

const CATALOG_CATEGORIES = [
  { id: 'location', label: 'Ubicaciones', icon: MapPin, types: ['department', 'city', 'zone'] },
  { id: 'kitchen', label: 'Cocina', icon: UtensilsCrossed, types: ['utensil', 'appliance'] },
  { id: 'living_room', label: 'Sala', icon: Sofa, types: ['furniture', 'decoration'] },
  { id: 'bedroom', label: 'Dormitorio', icon: Bed, types: ['furniture', 'linen', 'amenity'] }
];

export default function Catalog() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.catalog);
  const [activeCategory, setActiveCategory] = useState('location');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    category: 'location',
    type: 'department',
    name: '',
    description: '',
    parent_id: null
  });

  useEffect(() => {
    dispatch(fetchCatalogItems({ category: activeCategory }));
  }, [dispatch, activeCategory]);

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setSearchTerm('');
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      category: activeCategory,
      type: CATALOG_CATEGORIES.find(c => c.id === activeCategory)?.types[0] || '',
      name: '',
      description: '',
      parent_id: null
    });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      type: item.type,
      name: item.name,
      description: item.description || '',
      parent_id: item.parent_id
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este ítem?')) return;
    try {
      await dispatch(deleteCatalogItem(id)).unwrap();
      toast.success('Ítem eliminado correctamente');
    } catch (error) {
      // Error already handled by interceptor
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await dispatch(updateCatalogItem({ id: editingItem.id, data: formData })).unwrap();
        toast.success('Ítem actualizado correctamente');
      } else {
        await dispatch(createCatalogItem(formData)).unwrap();
        toast.success('Ítem creado correctamente');
      }
      setShowModal(false);
      dispatch(fetchCatalogItems({ category: activeCategory }));
    } catch (error) {
      // Error already handled
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryIcon = (categoryId) => {
    const category = CATALOG_CATEGORIES.find(c => c.id === categoryId);
    return category ? category.icon : MapPin;
  };

  const currentCategory = CATALOG_CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Catálogo</h1>
        <p className="text-gray-600">
          Gestiona listas reutilizables para mantener consistencia en tus datos
        </p>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex border-b border-gray-200">
          {CATALOG_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition ${
                  activeCategory === category.id
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} />
                <span>{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar ítems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition whitespace-nowrap"
          >
            <Plus size={20} />
            Nuevo Ítem
          </button>
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          {React.createElement(getCategoryIcon(activeCategory), { className: 'mx-auto text-gray-400 mb-4', size: 48 })}
          <p className="text-gray-600 mb-4">No hay ítems registrados en esta categoría</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={20} />
            Crear Primer Ítem
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {item.parent_name && (
                      <div className="text-sm text-gray-500">↳ {item.parent_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingItem ? 'Editar Ítem' : 'Nuevo Ítem'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {currentCategory?.types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Ej: Cesar, Valledupar, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descripción
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="Descripción opcional..."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                >
                  {editingItem ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
