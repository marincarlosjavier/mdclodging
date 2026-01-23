import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
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
import BreakfastList from './pages/BreakfastList';
import CheckoutReport from './pages/CheckoutReport';
import CheckinReport from './pages/CheckinReport';
import Layout from './components/Layout';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
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
