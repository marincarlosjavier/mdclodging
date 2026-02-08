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
  Coffee,
  FileText,
  DoorOpen,
  Shield,
  DollarSign,
  Wrench,
  Sparkles
} from 'lucide-react';
import { useState } from 'react';
import ConfirmModal from './ConfirmModal';

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  // Helper to check if user has any of the specified roles
  const hasRole = (...roles) => {
    const userRoles = Array.isArray(user?.role) ? user.role : [user?.role];
    return userRoles.some(role => roles.includes(role));
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...(hasRole('admin', 'supervisor')
      ? [
          { path: '/occupancy-calendar', label: 'Calendario', icon: Calendar },
          { path: '/reservations', label: 'Reservas', icon: List }
        ]
      : []),
    { path: '/breakfast-list', label: 'Comedor', icon: Coffee },

    // Housekeeping - ahora es parent con submenú
    ...(hasRole('admin', 'supervisor')
      ? [
          {
            path: '/checkout-report',
            label: 'Housekeeping',
            icon: Sparkles,
            children: [
              { path: '/checkout-report', label: 'Reporte de Check-out', icon: DoorOpen },
              { path: '/cleaning-settlements', label: 'Liquidaciones', icon: DollarSign }
            ]
          }
        ]
      : []),

    // Mantenimiento - ahora es parent con submenú
    {
      path: '/tasks',
      label: 'Mantenimiento',
      icon: Wrench,
      children: [
        { path: '/tasks', label: 'Tareas', icon: ListTodo },
        ...(hasRole('admin', 'supervisor')
          ? [{ path: '/maintenance-settlements', label: 'Liquidaciones', icon: DollarSign }]
          : [])
      ]
    },

    // Configuración - NUEVO grupo
    ...(hasRole('admin', 'supervisor')
      ? [
          {
            path: '/property-types',
            label: 'Configuración',
            icon: Settings,
            children: [
              { path: '/property-types', label: 'Tipos de Propiedad', icon: Building2 },
              { path: '/properties', label: 'Propiedades', icon: Building2 },
              { path: '/catalog', label: 'Catálogo', icon: List },
              { path: '/users', label: 'Usuarios', icon: Users },
              {
                path: '/telegram',
                label: 'Telegram',
                icon: MessageCircle,
                children: [
                  { path: '/telegram/permissions', label: 'Permisos', icon: Shield }
                ]
              }
            ]
          }
        ]
      : []),

    // Ajustes del Sistema (admin only)
    ...(hasRole('admin')
      ? [{ path: '/settings', label: 'Ajustes del Sistema', icon: Settings }]
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
            <p className="text-sm text-gray-500 capitalize">
              {Array.isArray(user?.role) ? user.role.join(', ') : user?.role}
            </p>
            <p className="text-xs text-gray-400 mt-1">{user?.tenant?.name}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <div key={item.path}>
                <NavLink
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

                {/* Level 1 children */}
                {item.children && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <div key={child.path}>
                        <NavLink
                          to={child.path}
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                              isActive
                                ? 'bg-primary-50 text-primary-600 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`
                          }
                        >
                          <child.icon size={18} />
                          <span>{child.label}</span>
                        </NavLink>

                        {/* Level 2 children (Telegram dentro de Configuración) */}
                        {child.children && (
                          <div className="ml-4 mt-1 space-y-1">
                            {child.children.map((subChild) => (
                              <NavLink
                                key={subChild.path}
                                to={subChild.path}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                  `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-xs ${
                                    isActive
                                      ? 'bg-primary-50 text-primary-600 font-medium'
                                      : 'text-gray-500 hover:bg-gray-50'
                                  }`
                                }
                              >
                                <subChild.icon size={16} />
                                <span>{subChild.label}</span>
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Logout button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => setShowLogoutModal(true)}
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

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Cerrar Sesión"
        message="¿Estás seguro de que deseas cerrar sesión?"
        confirmText="Cerrar Sesión"
        cancelText="Cancelar"
      />
    </div>
  );
}
