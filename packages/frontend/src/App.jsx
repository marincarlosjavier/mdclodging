import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Users from './pages/Users';
import Telegram from './pages/Telegram';
import Settings from './pages/Settings';
import PropertyTypes from './pages/PropertyTypes';
import Properties from './pages/Properties';
import Catalog from './pages/Catalog';
import Reservations from './pages/Reservations';
import CleaningTasks from './pages/CleaningTasks';
import CleaningSettlements from './pages/CleaningSettlements';
import MaintenanceSettlements from './pages/MaintenanceSettlements';
import BreakfastList from './pages/BreakfastList';
import CheckoutReport from './pages/CheckoutReport';
import CheckinReport from './pages/CheckinReport';
import TodayCheckins from './pages/TodayCheckins';
import OccupancyCalendar from './pages/OccupancyCalendar';
import Layout from './components/Layout';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    // Support both single role and array of roles
    const userRoles = Array.isArray(user?.role) ? user.role : [user?.role];
    const hasRequiredRole = userRoles.some(userRole => allowedRoles.includes(userRole));

    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}

function App() {
  const { token } = useSelector((state) => state.auth);

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={token ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route
        path="/signup"
        element={token ? <Navigate to="/dashboard" replace /> : <SignUp />}
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route
          path="property-types"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <PropertyTypes />
            </ProtectedRoute>
          }
        />
        <Route
          path="properties"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Properties />
            </ProtectedRoute>
          }
        />
        <Route
          path="reservations"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Reservations />
            </ProtectedRoute>
          }
        />
        <Route
          path="cleaning-tasks"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <CleaningTasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="cleaning-settlements"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <CleaningSettlements />
            </ProtectedRoute>
          }
        />
        <Route
          path="maintenance-settlements"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <MaintenanceSettlements />
            </ProtectedRoute>
          }
        />
        <Route
          path="breakfast-list"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <BreakfastList />
            </ProtectedRoute>
          }
        />
        <Route
          path="checkout-report"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <CheckoutReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="checkin-report"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor', 'staff']}>
              <CheckinReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="today-checkins"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <TodayCheckins />
            </ProtectedRoute>
          }
        />
        <Route
          path="occupancy-calendar"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <OccupancyCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="catalog"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Catalog />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="telegram"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <Telegram />
            </ProtectedRoute>
          }
        />
        <Route
          path="telegram/permissions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Telegram />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
