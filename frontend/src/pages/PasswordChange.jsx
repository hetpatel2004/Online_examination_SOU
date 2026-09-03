import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'lazysizes';
import 'lazysizes/plugins/parent-fit/parent-fit';

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
    <div className="password-change-page">
      <div className="password-change-card">
        <h2>Change Password</h2>
        <p>Enter your current password and new password</p>
        
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
      </div>
    </div>
  );
};

export default PasswordChange;

// Simple inline styles for the password change page
const passwordChangeStyles = `
  .password-change-page {
    min-height: 100vh;
    background: #667eea;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .password-change-card {
    background: white;
    padding: 40px;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    width: 100%;
    max-width: 420px;
  }
  
  .password-change-card h2 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 24px;
    color: #333;
  }
  
  .password-change-card p {
    color: #666;
    margin-bottom: 24px;
    font-size: 14px;
  }
  
  .form-group {
    margin-bottom: 20px;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #555;
    font-size: 14px;
  }
  
  .form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 15px;
    transition: border-color 0.3s;
  }
  
  .form-group input:focus {
    outline: none;
    border-color: #764ba2;
  }
  
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }
  
  .btn-primary {
    flex: 1;
    padding: 12px 24px;
    background: #764ba2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.3s;
  }
  
  .btn-primary:hover {
    background: #6a3d95;
  }
  
  .btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

console.log('PasswordChange styles loaded');
`;