import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { register } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

/**
 * Register Page Component
 * 
 * WHAT THIS PAGE DOES:
 * ====================
 * 1. Shows registration form for new users
 * 2. Validates enrollment number (13 digits) and Aadhar (12 digits)
 * 3. Has show/hide password toggle for Aadhar and Confirm fields
 * 4. Sends registration data to backend API
 * 5. On success: redirects based on role
 * 
 * ROLE AUTO-ASSIGNMENT:
 * =====================
 * No role selection on registration form!
 * Backend automatically assigns role based on enrollment number:
 * - "ADMIN001" → admin role
 * - "2504070200049" → user role
 * 
 * PASSWORD TOGGLE:
 * ===============
 * Two separate toggle states for Aadhar and Confirm Password:
 * - showAadhar: controls Aadhar field visibility
 * - showConfirm: controls Confirm Password field visibility
 * Each has its own eye icon that toggles between open/closed
 */
const Register = () => {
  const [courses, setCourses] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    enrollmentNumber: '',
    email: '',
    phone: '',
    course: '',
    semester: '1',
    aadharNumber: '',
    confirmPassword: ''
  });
  const [showAadhar, setShowAadhar] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    API.get('/superadmin/courses/public').then(({ data }) => {
      const list = data.courses || [];
      setCourses(list);
      if (list.length > 0 && !formData.course) {
        setFormData(prev => ({ ...prev, course: list[0].code }));
      }
    }).catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'course') {
      const course = courses.find(c => c.code === value);
      const total = course?.totalSemesters || 4;
      setFormData(prev => ({
        ...prev,
        course: value,
        semester: Number(prev.semester) > total ? '1' : prev.semester
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const isAdminEnrollment = formData.enrollmentNumber.toUpperCase().startsWith('ADMIN');
    if (!isAdminEnrollment && formData.enrollmentNumber.length < 5) {
      setError('Enrollment number must be at least 5 characters');
      return;
    }

    if (formData.aadharNumber.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.aadharNumber !== formData.confirmPassword) {
      setError('Password and confirm password do not match');
      return;
    }

    setLoading(true);
    try {
      // Send registration data to backend
      // Backend determines role based on enrollment number pattern
      const { data } = await register({
        name: formData.name,
        enrollmentNumber: formData.enrollmentNumber,
        email: formData.email,
        phone: formData.phone,
        course: formData.course,
        semester: formData.semester,
        aadharNumber: formData.aadharNumber
      });
      
      // Store user data in auth context (includes role from backend)
      login(data.user, data.token);
      
      toast.success(`Account created successfully! Welcome, ${data.user.name}!`);
      
      /**
       * REDIRECT BASED ON ROLE
       * Backend assigns role automatically:
       * - enrollment starting with "ADMIN" → admin → /admin-dashboard
       * - all others → user → /dashboard
       */
      if (data.user.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-sidebar">
        <div className="sidebar-content">
          <Link to="/" className="back-home">&larr; Back to Home</Link>
          <h2>Silver Oak University</h2>
          <h3>Online Examination Portal</h3>
          <p>Register with your enrollment number to access the examination platform.</p>
          <div className="sidebar-features">
            <div className="sidebar-feature">
              <span>&#10003;</span>
              <span>Free Registration</span>
            </div>
            <div className="sidebar-feature">
              <span>&#10003;</span>
              <span>Secure Platform</span>
            </div>
            <div className="sidebar-feature">
              <span>&#10003;</span>
              <span>Instant Results</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="auth-form-container">
        <div className="auth-form-wrapper">
          <h2>Create Account</h2>
          <p className="auth-subtitle">Fill in your details to register</p>
          
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Enrollment Number</label>
              <input
                type="text"
                name="enrollmentNumber"
                placeholder="Enter your enrollment number"
                value={formData.enrollmentNumber}
                onChange={handleChange}
                required
                maxLength="13"
              />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={handleChange}
                required
                maxLength="10"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Course</label>
                <select name="course" value={formData.course} onChange={handleChange} required>
                  {courses.length > 0 ? courses.map(c => (
                    <option key={c._id} value={c.code}>{c.name}</option>
                  )) : <option value="">Loading courses...</option>}
                </select>
              </div>
              <div className="form-group">
                <label>Semester</label>
                <select name="semester" value={formData.semester} onChange={handleChange} required>
                  {(() => {
                    const course = courses.find(c => c.code === formData.course);
                    const total = course?.totalSemesters || 4;
                    return Array.from({ length: total }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Semester {i + 1}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showAadhar ? 'text' : 'password'}
                  name="aadharNumber"
                  placeholder="Enter your password"
                  value={formData.aadharNumber}
                  onChange={handleChange}
                  required
                  maxLength="12"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowAadhar(!showAadhar)}
                >
                  {showAadhar ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Registering...' : 'Register Now'}
            </button>
          </form>
          
          <p className="auth-switch">
            Already have an account? <Link to="/login">Login here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
