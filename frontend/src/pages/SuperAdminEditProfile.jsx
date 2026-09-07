import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from '../components/Sidebar';

const SuperAdminEditProfile = () => {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState('edit-profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await API.put('/superadmin/profile', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone
      });
      toast.success('Profile updated successfully!');
      // Update auth context user data
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (formData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await API.post('/auth/change-password', {
        oldPassword: formData.currentPassword,
        newPassword: formData.newPassword
      });
      toast.success('Password changed successfully!');
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <Sidebar role="superadmin" activePage={activePage} onNavigate={setActivePage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        <div className="dashboard-main">
          <nav className="dashboard-nav">
            <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <div className="nav-brand"><span className="admin-badge">SUPER ADMIN PANEL</span></div>
            <div className="nav-welcome">Welcome, {user?.name}</div>
          </nav>
          <div className="dashboard-content">
            <div className="edit-profile-page">
              <div className="page-header">
                <h1>Edit Profile</h1>
                <p>Manage your account settings and preferences</p>
              </div>

              <div className="profile-grid">
                <div className="profile-card">
                  <div className="profile-header">
                    <div className="profile-avatar">
                      {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                    </div>
                    <div className="profile-info">
                      <h2>{user?.name || 'Super Admin'}</h2>
                      <p className="profile-role">Super Administrator</p>
                      <p className="profile-enrollment">{user?.enrollmentNumber || 'SUPER001'}</p>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h3>Personal Information</h3>
                    <form onSubmit={handleSaveProfile}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Full Name</label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter your full name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Email Address</label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter your email"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Phone Number</label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="Enter your phone number"
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="profile-section">
                    <h3>Change Password</h3>
                    <form onSubmit={handleChangePassword}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Current Password</label>
                          <input
                            type="password"
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter current password"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>New Password</label>
                          <input
                            type="password"
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter new password (min 6 chars)"
                            minLength={6}
                          />
                        </div>
                        <div className="form-group">
                          <label>Confirm New Password</label>
                          <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            required
                            placeholder="Confirm new password"
                          />
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn-secondary" disabled={loading}>
                          {loading ? 'Changing...' : 'Change Password'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="settings-card">
                  <h3>Account Settings</h3>
                  <div className="settings-list">
                    <div className="setting-item">
                      <div className="setting-info">
                        <span className="setting-icon">🔒</span>
                        <div>
                          <strong>Two-Factor Authentication</strong>
                          <p>Add an extra layer of security</p>
                        </div>
                      </div>
                      <button className="btn-secondary btn-sm">Enable</button>
                    </div>
                    <div className="setting-item">
                      <div className="setting-info">
                        <span className="setting-icon">🔔</span>
                        <div>
                          <strong>Notifications</strong>
                          <p>Manage email and push notifications</p>
                        </div>
                      </div>
                      <button className="btn-secondary btn-sm">Configure</button>
                    </div>
                    <div className="setting-item">
                      <div className="setting-info">
                        <span className="setting-icon">🌐</span>
                        <div>
                          <strong>Language & Region</strong>
                          <p>Set your preferred language</p>
                        </div>
                      </div>
                      <button className="btn-secondary btn-sm">Change</button>
                    </div>
                  </div>

                  <div className="danger-zone">
                    <h4>Danger Zone</h4>
                    <p>These actions are irreversible</p>
                    <button className="btn-danger" onClick={() => { logout(); navigate('/login'); }}>
                      🚪 Sign Out Everywhere
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminEditProfile;