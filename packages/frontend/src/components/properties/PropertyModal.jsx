import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

export default function PropertyModal({ property, propertyTypes, onClose }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    property_type_id: '',
    name: '',
    status: 'available',
    notes: ''
  });

  useEffect(() => {
    if (property) {
      setFormData({
        property_type_id: property.property_type_id || '',
        name: property.name || '',
        status: property.status || 'available',
        notes: property.notes || ''
      });
    }
  }, [property]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.property_type_id || !formData.name) {
      toast.error('Tipo de propiedad y nombre son requeridos');
      return;
    }

    try {
      setLoading(true);
      if (property?.id) {
        await api.put(`/properties/${property.id}`, formData);
        toast.success('Propiedad actualizada correctamente');
      } else {
        await api.post('/properties', formData);
        toast.success('Propiedad creada correctamente');
      }
      onClose();
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Error al guardar propiedad';
      toast.error(errorMsg);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {property ? 'Editar Propiedad' : 'Nueva Propiedad'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-4">
            {/* Property Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de Propiedad *
              </label>
              <select
                name="property_type_id"
                value={formData.property_type_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Seleccionar tipo...</option>
                {propertyTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.property_category})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                El tipo define las habitaciones y características de la propiedad
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre/Número *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Ej: Apto 101, Habitación 205, Casa A"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estado
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="available">Disponible</option>
                <option value="occupied">Ocupado</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="cleaning">Limpieza</option>
                <option value="reserved">Reservado</option>
              </select>
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
                rows={3}
                placeholder="Notas adicionales sobre esta propiedad..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:bg-gray-400"
          >
            {loading ? 'Guardando...' : property ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
