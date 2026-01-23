import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import {
  LayoutDashboard,
  ListTodo,
  Users,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  List,
  Calendar,
  ClipboardList,
  Coffee
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tasks', label: 'Tareas', icon: ListTodo },
    ...(user?.role === 'admin' || user?.role === 'supervisor'
      ? [
          { path: '/property-types', label: 'Tipos de Propiedad', icon: Building2 },
          { path: '/properties', label: 'Propiedades', icon: Building2 },
          { path: '/reservations', label: 'Reservas', icon: Calendar },
          { path: '/catalog', label: 'Catálogo', icon: List },
          { path: '/users', label: 'Usuarios', icon: Users },
          { path: '/telegram', label: 'Telegram', icon: MessageCircle }
        ]
      : []),
    { path: '/cleaning-tasks', label: 'Tareas de Limpieza', icon: ClipboardList },
    { path: '/breakfast-list', label: 'Lista de Desayunos', icon: Coffee },
    ...(user?.role === 'admin'
      ? [{ path: '/settings', label: 'Configuración', icon: Settings }]
      : [])
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 z-50 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">MDCLodging</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-gray-200">
            <p className="font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
            <p className="text-xs text-gray-400 mt-1">{user?.tenant?.name}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-bold text-primary-600">MDCLodging</h1>
            <div className="w-6" />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
