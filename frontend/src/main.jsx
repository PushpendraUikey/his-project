import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth, canAccess, ROLE_ACCESS } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registration from './pages/Registration';
import Admission from './pages/Admission';
import Nurse from './pages/Nurse';
import Doctor from './pages/Doctor';
import Lab from './pages/Lab';
import HIE from './pages/HIE';
import Admin from './pages/Admin';
import ChangePassword from './pages/ChangePassword';

const ROUTE_MAP = {
  registration: '/registration',
  admission:    '/admission',
  nurse:        '/nurse',
  doctor:       '/doctor',
  lab:          '/lab',
  hie:          '/hie',
  admin:        '/admin',
};

// Route guard: redirect to login if not authenticated
function RequireAuth({ children }) {
  const { auth } = useAuth();
  const location = useLocation();
  if (!auth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// Role guard: redirect to appropriate page if role doesn't have access
function RequireRole({ module, children }) {
  const { user } = useAuth();
  if (!user || !canAccess(user.role, module)) {
    const allowed = ROLE_ACCESS[user?.role] || [];
    const first = ROUTE_MAP[allowed[0]] || '/login';
    return <Navigate to={first} replace />;
  }
  return children;
}

// Default redirect based on role
function RoleRedirect() {
  const { user } = useAuth();
  const roleDefaults = {
    doctor:            '/doctor',
    nurse:             '/nurse',
    lab_technician:    '/lab',
    admin:             '/admin',
    registration_desk: '/registration',
    admission_desk:    '/admission',
    receptionist:      '/registration',
  };
  return <Navigate to={roleDefaults[user?.role] || '/login'} replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route path="/" element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }>
            <Route index element={<RoleRedirect />} />
            <Route path="registration" element={
              <RequireRole module="registration"><Registration /></RequireRole>
            } />
            <Route path="admission" element={
              <RequireRole module="admission"><Admission /></RequireRole>
            } />
            <Route path="nurse" element={
              <RequireRole module="nurse"><Nurse /></RequireRole>
            } />
            <Route path="doctor" element={
              <RequireRole module="doctor"><Doctor /></RequireRole>
            } />
            <Route path="lab" element={
              <RequireRole module="lab"><Lab /></RequireRole>
            } />
            <Route path="hie" element={
              <RequireRole module="hie"><HIE /></RequireRole>
            } />
            <Route path="admin" element={
              <RequireRole module="admin"><Admin /></RequireRole>
            } />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
