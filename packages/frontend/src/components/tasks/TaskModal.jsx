import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { tasksAPI } from '../../services/api';
import { usersAPI } from '../../services/api';
import { toast } from 'react-toastify';

export default function TaskModal({ task, onClose, onSuccess }) {
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'cleaning',
    location: '',
    room_number: '',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    estimated_duration: '',
    notes: ''
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        task_type: task.task_type || 'cleaning',
        location: task.location || '',
        room_number: task.room_number || '',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date ? task.due_date.substring(0, 16) : '',
        estimated_duration: task.estimated_duration || '',
        notes: task.notes || ''
      });
    }
  }, [task]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll({ is_active: true });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (task) {
        await tasksAPI.update(task.id, formData);
        toast.success('Tarea actualizada correctamente');
      } else {
        await tasksAPI.create(formData);
        toast.success('Tarea creada correctamente');
      }
      onSuccess();
    } catch (error) {
      // Error already handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {task ? 'Editar Tarea' : 'Nueva Tarea'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ej: Limpieza habitación 101"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              placeholder="Descripción detallada de la tarea..."
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo *
              </label>
              <select
                name="task_type"
                value={formData.task_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="cleaning">Limpieza</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="inspection">Inspección</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridad *
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          {/* Location and Room */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ubicación *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Ej: Piso 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Habitación
              </label>
              <input
                type="text"
                name="room_number"
                value={formData.room_number}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Ej: 205"
              />
            </div>
          </div>

          {/* Assigned To and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asignar a
              </label>
              <select
                name="assigned_to"
                value={formData.assigned_to}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha límite
              </label>
              <input
                type="datetime-local"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>

          {/* Estimated Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración estimada (minutos)
            </label>
            <input
              type="number"
              name="estimated_duration"
              value={formData.estimated_duration}
              onChange={handleChange}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Ej: 30"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="2"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none resize-none"
              placeholder="Notas adicionales..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : task ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
