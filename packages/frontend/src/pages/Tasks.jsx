import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTasks, importTasksFromExcel } from '../store/slices/tasksSlice';
import { tasksAPI } from '../services/api';
import { toast } from 'react-toastify';
import {
  Plus,
  Upload,
  Download,
  Filter,
  Search,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import TaskModal from '../components/tasks/TaskModal';
import TaskCard from '../components/tasks/TaskCard';

export default function Tasks() {
  const dispatch = useDispatch();
  const { tasks, loading } = useSelector((state) => state.tasks);
  const { user } = useSelector((state) => state.auth);

  const [showModal, setShowModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    task_type: ''
  });

  useEffect(() => {
    dispatch(fetchTasks(filters));
  }, [dispatch, filters]);

  const handleCreateTask = () => {
    setSelectedTask(null);
    setShowModal(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setShowModal(true);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await tasksAPI.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tasks_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template descargado correctamente');
    } catch (error) {
      toast.error('Error al descargar template');
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await dispatch(importTasksFromExcel(file)).unwrap();
      toast.success(
        `Importación completada: ${result.imported} tareas creadas${
          result.failed > 0 ? `, ${result.failed} fallaron` : ''
        }`
      );
      dispatch(fetchTasks(filters));
    } catch (error) {
      // Error already handled by toast
    }

    e.target.value = '';
  };

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageTasks = ['admin', 'supervisor'].includes(user?.role);

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pendiente' },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle, label: 'En Progreso' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completada' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Cancelada' }
    };
    return badges[status] || badges.pending;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tareas</h1>
        <p className="text-gray-600">
          Gestiona todas las tareas del hotel
        </p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Filters */}
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Todas las prioridades</option>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>

          {canManageTasks && (
            <>
              {/* Download Template */}
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Download size={20} />
                <span className="hidden md:inline">Template</span>
              </button>

              {/* Import Excel */}
              <label className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition cursor-pointer">
                <Upload size={20} />
                <span className="hidden md:inline">Importar</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
              </label>

              {/* Create Task */}
              <button
                onClick={handleCreateTask}
                className="flex items-center gap-2 px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
              >
                <Plus size={20} />
                <span className="hidden md:inline">Nueva Tarea</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tasks Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Clock size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay tareas
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'No se encontraron tareas con ese criterio' : 'Comienza creando una nueva tarea'}
          </p>
          {canManageTasks && !searchTerm && (
            <button
              onClick={handleCreateTask}
              className="inline-flex items-center gap-2 px-6 py-3 text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition"
            >
              <Plus size={20} />
              Nueva Tarea
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={canManageTasks ? handleEditTask : undefined}
            />
          ))}
        </div>
      )}

      {/* Task Modal */}
      {showModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            dispatch(fetchTasks(filters));
          }}
        />
      )}
    </div>
  );
}
