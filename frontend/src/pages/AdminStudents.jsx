import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from '../components/Sidebar';

const AdminStudents = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('students');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [semesters, setSemesters] = useState([]);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleSidebarNavigate = (page) => {
    if (page === 'students') {
      return;
    }
    if (page === 'change-password') {
      navigate('/change-password');
    } else {
      navigate('/admin-dashboard');
    }
    if (sidebarOpen) setSidebarOpen(false);
  };

  // Fetch all courses/programs
  const fetchCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/admin/programs');
      setCourses(data.courses || []);
      setPrograms(data.courses || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch semesters for selected program
  const fetchSemesters = async (programCode) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/admin/users', {
        params: { role: 'user', program: programCode }
      });
      const programStudents = data.users || [];
      const semesterList = [
        ...new Set(
          programStudents.map((u) => u.semester).filter(Boolean)
        )
      ].sort((a, b) => Number(a) - Number(b));
      setSemesters(semesterList);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load semesters');
    } finally {
      setLoading(false);
    }
  };

  // Fetch students for selected program + semester
  const fetchStudents = async (programCode, semester) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/admin/users', {
        params: { role: 'user', program: programCode, semester }
      });
      setUsers(data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      fetchSemesters(selectedProgram.code);
      setStep(2);
    } else {
      setStep(1);
      setSemesters([]);
      setUsers([]);
    }
  }, [selectedProgram]);

  useEffect(() => {
    if (selectedProgram && selectedSemester) {
      fetchStudents(selectedProgram.code, selectedSemester);
      setStep(3);
    } else if (selectedProgram && !selectedSemester) {
      setStep(2);
      setUsers([]);
    }
  }, [selectedSemester]);

  const handleProgramClick = (program) => {
    setSelectedProgram(program);
    setSelectedSemester(null);
    setSearchTerm('');
  };

  const handleSemesterClick = (semester) => {
    setSelectedSemester(semester);
    setSearchTerm('');
  };

  const goBack = () => {
    if (step === 3) {
      setSelectedSemester(null);
      setUsers([]);
    } else if (step === 2) {
      setSelectedProgram(null);
      setSemesters([]);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.enrollmentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStep1 = () => (
    <div className="students-flow">
      <div className="flow-header">
        <h2>Select Program</h2>
        <p>Choose a program to view its semesters and students</p>
      </div>
      <div className="program-grid">
        {loading ? (
          <div className="loading">Loading programs...</div>
        ) : programs.length === 0 ? (
          <div className="no-data-state">
            <span className="coming-icon">📚</span>
            <h3>No Programs Found</h3>
            <p>No programs available in the system.</p>
          </div>
        ) : (
          programs.map((program) => (
            <button
              key={program._id}
              className="program-card"
              onClick={() => handleProgramClick(program)}
            >
              <div className="program-card-icon">🎓</div>
              <div className="program-card-name">{program.name}</div>
              <div className="program-card-code">{program.code}</div>
              <div className="program-card-semesters">
                {program.totalSemesters} Semesters
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="students-flow">
      <div className="flow-header">
        <div className="breadcrumb" onClick={goBack}>
          <span className="breadcrumb-item">Programs</span>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-item breadcrumb-current">{selectedProgram.name}</span>
        </div>
        <h2>Select Semester</h2>
        <p>Choose a semester to view students</p>
      </div>
      <div className="semester-grid">
        {loading ? (
          <div className="loading">Loading semesters...</div>
        ) : semesters.length === 0 ? (
          <div className="no-data-state">
            <span className="coming-icon">📅</span>
            <h3>No Semesters Found</h3>
            <p>No students enrolled in this program yet.</p>
          </div>
        ) : (
          semesters.map((sem) => (
            <button
              key={sem}
              className="semester-card"
              onClick={() => handleSemesterClick(sem)}
            >
              <div className="semester-card-number">Sem {sem}</div>
              <div className="semester-card-label">Click to view students</div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="students-flow">
      <div className="flow-header">
        <div className="breadcrumb" onClick={goBack}>
          <span className="breadcrumb-item">Programs</span>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-item" onClick={() => setSelectedSemester(null)}>{selectedProgram.name}</span>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-item breadcrumb-current">Sem {selectedSemester}</span>
        </div>
        <div className="step3-header">
          <div>
            <h2>Students in {selectedProgram.name} - Sem {selectedSemester}</h2>
            <p>{filteredUsers.length} student(s) found</p>
          </div>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, enrollment, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>
      <div className="students-table-container">
        {loading ? (
          <div className="loading">Loading students...</div>
        ) : error ? (
          <div className="error-msg">{error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="no-data-state">
            <span className="coming-icon">👥</span>
            <h3>No Students Found</h3>
            <p>{searchTerm ? 'No students match your search.' : 'No students enrolled in this semester.'}</p>
          </div>
        ) : (
          <div className="students-table-wrapper">
            <table className="students-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Enrollment</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u, i) => (
                  <tr key={u._id}>
                    <td data-label="#">{i + 1}</td>
                    <td data-label="Name" className="name-cell">
                      {u.name}
                      {u.isBlocked && <span className="status-blocked-badge">Blocked</span>}
                    </td>
                    <td data-label="Enrollment" className="enrollment-cell">
                      {u.enrollmentNumber}
                    </td>
                    <td data-label="Email">{u.email || '—'}</td>
                    <td data-label="Status">
                      <span className={`status-badge ${u.isBlocked ? 'blocked' : 'active'}`}>
                        {u.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td data-label="Actions" className="actions-cell">
                      <button className="btn-icon btn-view" title="View Details">👁️</button>
                      <button
                        className="btn-icon btn-block"
                        title={u.isBlocked ? 'Unblock' : 'Block'}
                      >
                        {u.isBlocked ? '✅' : '🚫'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <Sidebar role="admin" activePage={activePage} onNavigate={handleSidebarNavigate} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        <div className="dashboard-main">
          <nav className="dashboard-nav">
            <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <div className="nav-brand"><span className="admin-badge">ADMIN PANEL</span></div>
            <div className="nav-welcome">Welcome, {user?.name}</div>
          </nav>
          <div className="dashboard-content">
            <div className="admin-students-page">
              <div className="page-header">
                <h1>All Students</h1>
                <p>Browse students by program and semester</p>
              </div>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStudents;