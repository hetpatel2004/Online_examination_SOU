import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from '../components/Sidebar';

const PasswordChange = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('change-password');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSidebarNavigate = (page) => {
    if (page === 'change-password') return;
    if (user?.role === 'superadmin') {
      navigate('/superadmin-dashboard');
    } else {
      navigate('/admin-dashboard');
    }
    if (sidebarOpen) setSidebarOpen(false);
  };

  const validateForm = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.warning('Please fill in all fields');
      return false;
    }
    if (newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return false;
    }
    return true;
  };

  const changePassword = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data } = await API.post('/auth/change-password', {
        oldPassword,
        newPassword
      });
      toast.success(data.message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (user?.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else {
        navigate('/admin-dashboard');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to change password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <Sidebar role={user?.role} activePage={activePage} onNavigate={handleSidebarNavigate} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        <div className="dashboard-main">
          <nav className="dashboard-nav">
            <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <div className="nav-brand"><span className="admin-badge">{user?.role === 'superadmin' ? 'SUPER ADMIN PANEL' : 'ADMIN PANEL'}</span></div>
            <div className="nav-welcome">Welcome, {user?.name}</div>
          </nav>
          <div className="dashboard-content">
            <div className="password-change-page">
              <div className="page-header">
                <h2>Change Password</h2>
                <p>Enter your current password and new password</p>
              </div>

              <div className="card">
                <div className="card-body">
                  <form onSubmit={(e) => { e.preventDefault(); changePassword(); }}>
                    <div className="form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                        required
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="form-actions">
                      {loading ? (
                        <button type="submit" className="btn-primary" disabled>
                          Changing password...
                        </button>
                      ) : (
                        <button type="submit" className="btn-primary">
                          Change Password
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordChange;