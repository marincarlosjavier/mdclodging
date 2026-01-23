import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTodaysTasks, fetchCleaningTasks, startCleaningTask, completeCleaningTask, updateCleaningTask } from '../store/slices/cleaningTasksSlice';
import { Clock, CheckCircle2, Play, Filter, User, Timer } from 'lucide-react';
import { toast } from 'react-toastify';

// Timer component to show elapsed time since checkout was reported
function ElapsedTimer({ startTime, endTime }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calculateElapsed = () => {
      const start = new Date(startTime);
      const end = endTime ? new Date(endTime) : new Date();
      const diffMs = end - start;
      const diffMins = Math.floor(diffMs / 60000);
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;

      if (hours > 0) {
        return `${hours}h ${mins}m`;
      } else {
        return `${mins}m`;
      }
    };

    setElapsed(calculateElapsed());

    if (!endTime) {
      const interval = setInterval(() => {
        setElapsed(calculateElapsed());
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [startTime, endTime]);

  const isUrgent = !endTime && (new Date() - new Date(startTime)) > 30 * 60000; // > 30 minutes

  return (
    <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
      <Timer className="w-3 h-3" />
      <span>{elapsed} {!endTime && 'esperando'}</span>
    </div>
  );
}

export default function CleaningTasks() {
  const dispatch = useDispatch();
  const { todaysTasks, loading } = useSelector((state) => state.cleaningTasks);
  const [view, setView] = useState('today'); // 'today' or 'all'
  const [selectedTask, setSelectedTask] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');

  useEffect(() => {
    if (view === 'today') {
      dispatch(fetchTodaysTasks());
    } else {
      dispatch(fetchCleaningTasks());
    }
  }, [dispatch, view]);

  const handleStart = async (taskId) => {
    try {
      await dispatch(startCleaningTask(taskId)).unwrap();
      toast.success('Tarea iniciada');
      dispatch(fetchTodaysTasks());
    } catch (error) {
      // Error already handled
    }
  };

  const handleComplete = async (taskId, notes) => {
    try {
      await dispatch(completeCleaningTask({ id: taskId, notes })).unwrap();
      toast.success('Tarea completada');
      setSelectedTask(null);
      setCompletionNotes('');
      dispatch(fetchTodaysTasks());
    } catch (error) {
      // Error already handled
    }
  };

  const getTaskTypeInfo = (type) => {
    const types = {
      check_out: {
        label: 'Check-out',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '🧹',
        description: 'Limpieza completa después de salida'
      },
      stay_over: {
        label: 'Stay-over',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '🧼',
        description: 'Limpieza ligera durante estadía'
      },
      deep_cleaning: {
        label: 'Limpieza Profunda',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '✨',
        description: 'Limpieza profunda programada'
      }
    };
    return types[type] || types.check_out;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completada',
      cancelled: 'Cancelada'
    };
    return labels[status] || status;
  };

  const TaskCard = ({ task }) => {
    const taskInfo = getTaskTypeInfo(task.task_type);

    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{taskInfo.icon}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{task.property_name}</h3>
              <p className="text-sm text-gray-500">{task.property_type_name}</p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full border ${taskInfo.color}`}>
            {taskInfo.label}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-3">{taskInfo.description}</p>

        {task.assigned_to_name && (
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <User className="w-4 h-4 mr-1" />
            <span>Asignado a: {task.assigned_to_name}</span>
          </div>
        )}

        {task.checkout_reported_at && (
          <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-800">Checkout reportado:</span>
              <ElapsedTimer
                startTime={task.checkout_reported_at}
                endTime={task.assigned_at}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
            {getStatusLabel(task.status)}
          </span>

          <div className="flex space-x-2">
            {task.status === 'pending' && (
              <button
                onClick={() => handleStart(task.id)}
                className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-1" />
                Iniciar
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={() => setSelectedTask(task)}
                className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Completar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas de Limpieza</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de housekeeping</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('today')}
            className={`px-4 py-2 rounded-lg transition ${
              view === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg transition ${
              view === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todas
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-500 mt-4">Cargando tareas...</p>
        </div>
      ) : view === 'today' && todaysTasks ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500">Total Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{todaysTasks.total || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500">Check-out</p>
              <p className="text-2xl font-bold text-red-600">{todaysTasks.grouped?.check_out?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500">Stay-over</p>
              <p className="text-2xl font-bold text-blue-600">{todaysTasks.grouped?.stay_over?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <p className="text-sm text-gray-500">Profunda</p>
              <p className="text-2xl font-bold text-purple-600">{todaysTasks.grouped?.deep_cleaning?.length || 0}</p>
            </div>
          </div>

          {/* Tasks by Type */}
          {todaysTasks.grouped && (
            <div className="space-y-6">
              {/* Check-out Tasks */}
              {todaysTasks.grouped.check_out && todaysTasks.grouped.check_out.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🧹</span>
                    Check-out ({todaysTasks.grouped.check_out.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todaysTasks.grouped.check_out.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* Stay-over Tasks */}
              {todaysTasks.grouped.stay_over && todaysTasks.grouped.stay_over.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">🧼</span>
                    Stay-over ({todaysTasks.grouped.stay_over.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todaysTasks.grouped.stay_over.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {/* Deep Cleaning Tasks */}
              {todaysTasks.grouped.deep_cleaning && todaysTasks.grouped.deep_cleaning.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">✨</span>
                    Limpieza Profunda ({todaysTasks.grouped.deep_cleaning.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todaysTasks.grouped.deep_cleaning.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )}

              {todaysTasks.total === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">No hay tareas de limpieza para hoy</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Vista de todas las tareas - En desarrollo</p>
        </div>
      )}

      {/* Completion Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Completar Tarea</h3>
              <p className="text-sm text-gray-600 mb-4">
                <strong>{selectedTask.property_name}</strong>
                <br />
                {getTaskTypeInfo(selectedTask.task_type).label}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas (opcional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows="3"
                  placeholder="Observaciones sobre la limpieza..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setCompletionNotes('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleComplete(selectedTask.id, completionNotes)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Completar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
