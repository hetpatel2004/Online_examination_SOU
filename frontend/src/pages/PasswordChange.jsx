import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const PasswordChange = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const changePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.warning('Please enter both old and new passwords');
      return;
    }

    if (newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { data } = await API.post('/auth/change-password', {
        oldPassword,
        newPassword
      });

      toast.success(data.message);
      navigate('/');
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
        <div className="dashboard-main">
          <div className="dashboard-content">
            <div className="page-header">
              <h2>Change Password</h2>
              <p>Enter your current password and new password</p>
            </div>
            
            <div className="card">
              <div className="card-body">
                <form>
                  <div className="form-group">
                    <label>Old Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <div className="form-actions">
                    {loading ? (
                      <button disabled>Changing password...</button>
                    ) : (
                      <button onClick={changePassword} className="btn-primary">
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
  );
};

export default PasswordChange;