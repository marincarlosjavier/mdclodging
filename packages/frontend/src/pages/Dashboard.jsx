import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { tasksAPI } from '../services/api';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  TrendingUp
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await tasksAPI.getAll();
      const tasks = Array.isArray(response.data) ? response.data : [];

      setStats({
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
        completed: tasks.filter((t) => t.status === 'completed').length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Tareas',
      value: stats.total,
      icon: TrendingUp,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Pendientes',
      value: stats.pending,
      icon: Clock,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'En Progreso',
      value: stats.in_progress,
      icon: AlertCircle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Completadas',
      value: stats.completed,
      icon: CheckCircle,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bienvenido, {user?.full_name}
        </h1>
        <p className="text-gray-600">
          {user?.tenant?.name} • {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon size={24} className={stat.textColor} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {stat.value}
            </p>
            <p className="text-sm text-gray-600">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Actividad Reciente
          </h2>
          <div className="space-y-4">
            <p className="text-gray-500 text-sm">
              No hay actividad reciente para mostrar.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Accesos Rápidos
          </h2>
          <div className="space-y-3">
            <a
              href="/tasks"
              className="flex items-center gap-3 p-3 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition"
            >
              <Clock size={20} />
              <span className="font-medium">Ver Todas las Tareas</span>
            </a>
            {(user?.role === 'admin' || user?.role === 'supervisor') && (
              <>
                <a
                  href="/users"
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
                >
                  <Users size={20} />
                  <span className="font-medium">Gestionar Usuarios</span>
                </a>
                <a
                  href="/telegram"
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
                >
                  <CheckCircle size={20} />
                  <span className="font-medium">Configurar Telegram</span>
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
