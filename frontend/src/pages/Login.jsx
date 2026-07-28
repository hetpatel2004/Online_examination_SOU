/**
 * Login Page Component
 * 
 * WHAT THIS PAGE DOES:
 * ====================
 * 1. Shows login form with enrollment number and password fields
 * 2. Has show/hide password toggle (eye icon)
 * 3. Sends credentials to backend API
 * 4. On success: stores user data and redirects based on ROLE
 * 
 * ROLE-BASED REDIRECTION:
 * =======================
 * After successful login, the backend returns user data with 'role' field.
 * 
 * - If user.role === 'admin' → Redirect to /admin-dashboard
 * - If user.role === 'user' → Redirect to /dashboard
 * 
 * No dropdown needed! The role is determined by enrollment number pattern:
 * - "ADMIN001" → admin
 * - "2504070200049" → user
 * 
 * HOW PASSWORD VISIBILITY TOGGLE WORKS:
 * ======================================
 * - showPassword state controls the input type
 * - When false: type="password" (dots shown)
 * - When true: type="text" (plain text shown)
 * - Eye icon SVG changes based on state
 * - Eye open = hidden, Eye closed = visible
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { login } from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  // Form data state - stores enrollment number and password
  const [formData, setFormData] = useState({
    enrollmentNumber: '',
    password: ''
  });
  
  // Password visibility state - controls show/hide toggle
  const [showPassword, setShowPassword] = useState(false);
  
  // Error state - stores error message to display
  const [error, setError] = useState('');
  
  // Loading state - disables button during API call
  const [loading, setLoading] = useState(false);
  
  // Navigation hook - used to redirect after login
  const navigate = useNavigate();
  
  // Auth context - provides login function to store user data
  const { login: authLogin } = useAuth();

  /**
   * Handle input changes
   * Updates formData state when user types in any field
   */
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  /**
   * Handle form submission
   * 
   * FLOW:
   * 1. Prevent default form submission
   * 2. Send credentials to backend API
   * 3. On success:
   *    - Store user data in auth context (including role)
   *    - Redirect based on role:
   *      - admin → /admin-dashboard
   *      - user → /dashboard
   * 4. On failure: Show error message
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Send login request to backend
      // API sends back: { token, user: { ..., role: 'admin' or 'user' } }
      const { data } = await login(formData);
      
      // Step 2: Store user data in auth context (includes role)
      authLogin(data.user, data.token);
      
      toast.success(`Welcome back, ${data.user.name}!`);
      
      /**
       * Step 3: REDIRECT BASED ON ROLE
       * 
       * data.user.role contains:
       * - 'admin' if enrollment started with "ADMIN"
       * - 'user' for all other enrollments
       * 
       * This determines which dashboard the user sees:
       * - Admin sees: Manage exams, questions, view all students
       * - User sees: Their subjects, exam schedules, upload assignments
       */
      if (data.user.role === 'superadmin') {
        navigate('/superadmin-dashboard');
      } else if (data.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      // Step 4: Show error if login fails
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left sidebar with university branding */}
      <div className="auth-sidebar">
        <div className="sidebar-content">
          <Link to="/" className="back-home">&larr; Back to Home</Link>
          <h2>Silver Oak University</h2>
          <h3>Online Examination Portal</h3>
          <p>
            Login with your enrollment number and password.
          </p>
          <div className="sidebar-features">
            <div className="sidebar-feature">
              <span>&#128214;</span>
              <span>Access your exams</span>
            </div>
            <div className="sidebar-feature">
              <span>&#128203;</span>
              <span>View results</span>
            </div>
            <div className="sidebar-feature">
              <span>&#128197;</span>
              <span>Check schedules</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Login form */}
      <div className="auth-form-container">
        <div className="auth-form-wrapper">
          <h2>Welcome Back!</h2>
          <p className="auth-subtitle">Login to access your examination portal</p>
          
          {/* Error message display */}
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            {/* Enrollment Number Field */}
            <div className="form-group">
              <label>Enrollment Number</label>
              <input
                type="text"
                name="enrollmentNumber"
                placeholder="Enter your enrollment number"
                value={formData.enrollmentNumber}
                onChange={handleChange}
                required
              />
              <span className="field-hint">
                Enter your enrollment number
              </span>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="form-group">
              <label>Password (Aadhar Number)</label>
              <div className="password-input-wrapper">
              {/* Toggle between text and password type */}
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter your Aadhar number"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                {/* Eye icon button to toggle password visibility */}
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {/* Show eye-open when hidden, eye-closed when visible */}
                  {showPassword ? (
                    // Eye closed icon - means password is visible, click to hide
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    // Eye open icon - means password is hidden, click to show
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              <span className="field-hint">Enter your password</span>
            </div>

            {/* Submit Button */}
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <p className="auth-switch">
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
