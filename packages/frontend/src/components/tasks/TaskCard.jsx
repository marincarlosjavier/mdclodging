import { Clock, MapPin, AlertCircle, CheckCircle, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TaskCard({ task, onEdit }) {
  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    pending: 'Pendiente',
    in_progress: 'En Progreso',
    completed: 'Completada',
    cancelled: 'Cancelada'
  };

  const priorityLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente'
  };

  const typeLabels = {
    cleaning: 'Limpieza',
    maintenance: 'Mantenimiento',
    inspection: 'Inspección',
    other: 'Otro'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={16} />
            <span>{task.location}</span>
            {task.room_number && <span>• Hab. {task.room_number}</span>}
          </div>
        </div>
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="text-gray-400 hover:text-primary-600 transition"
          >
            <Edit size={20} />
          </button>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            statusColors[task.status]
          }`}
        >
          {task.status === 'completed' ? (
            <CheckCircle size={12} />
          ) : (
            <Clock size={12} />
          )}
          {statusLabels[task.status]}
        </span>

        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            priorityColors[task.priority]
          }`}
        >
          {priorityLabels[task.priority]}
        </span>

        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
          {typeLabels[task.task_type]}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Clock size={14} />
          {task.due_date ? (
            <span>
              Vence {formatDistanceToNow(new Date(task.due_date), { addSuffix: true, locale: es })}
            </span>
          ) : (
            <span>Sin fecha límite</span>
          )}
        </div>

        {task.assigned_to && (
          <span className="text-xs">Asignada</span>
        )}
      </div>
    </div>
  );
}
