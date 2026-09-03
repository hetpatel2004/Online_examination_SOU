/**
 * App.jsx - Main Application Component with Routing
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import PasswordChange from './pages/PasswordChange';
import SuperAdminStudents from './pages/SuperAdminStudents';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <Router>
        <div className="app">
          <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin-dashboard" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/superadmin-dashboard" element={
              <ProtectedRoute>
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />
<Route path="/superadmin/students" element={
              <ProtectedRoute>
                <Suspense fallback={<div>Loading...</div>}>
                  <SuperAdminStudents />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/change-password" element={
              <ProtectedRoute>
                <PasswordChange />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
