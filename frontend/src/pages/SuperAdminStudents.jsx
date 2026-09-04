import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Suspense } from 'react';
import Sidebar from '../components/Sidebar';

const SuperAdminStudents = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('all-students');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [semesters, setSemesters] = useState([]);
  const navigate = useNavigate();

  // Fetch all courses/programs
  const fetchCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/superadmin/courses');
      setCourses(data.courses || []);
      setPrograms(data.courses || [];
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  // Fetch students with filters
  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/superadmin/students', {
        params: { program: selectedProgram, semester: semesterFilter }
      });
      setUsers(data.users || []);
      
      if (selectedProgram) {
        const programStudents = data.users || [];
        const semesterList = [
          ...new Set(
            programStudents.map((u) => u.semester).filter(Boolean)
          )
        ].sort((a, b) => Number(a) - Number(b));

        setSemesters(semesterList);
      } else {
        setSemesters([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchStudents();
  }, [selectedProgram, semesterFilter]);

  const handleProgramChange = (programCode) => {
    setSelectedProgram(programCode);
    setSemesterFilter('');
  };

  const handleSemesterChange = (semester) => {
    setSemesterFilter(semester);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.enrollmentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStudentsInProgram = filteredUsers.length;

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <Sidebar role="superadmin" activePage={activePage} onNavigate={() => {}} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
        <div className="dashboard-main">
          <nav className="dashboard-nav">
            <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <div className="nav-brand"><span className="admin-badge">SUPER ADMIN PANEL</span></div>
            <div className="nav-welcome">Welcome, {user?.name}</div>
          </nav>
          <div className="dashboard-content">
            <div className="superadmin-students-page">
              <div className="page-header">
                <h1>All Students</h1>
                <p>Manage and view all student accounts</p>
              </div>

              <div className="filters-section">
                <div className="program-filter">
                  <span>Program:</span>
                  <button
                    className={`filter-btn ${selectedProgram === '' ? 'active' : ''}`}
                    onClick={() => handleProgramChange('')}
                  >
                    All Programs
                  </button>

                  {programs.length > 0 ? (
                    programs.map((c) => (
                      <button
                        key={c._id}
                        className={`filter-btn ${selectedProgram === c.code ? 'active' : ''}`}
                        onClick={() => handleProgramChange(c.code)}
                      >
                        {c.name}
                      </button>
                    ))
                  ) : (
                    <span className="filter-loading">Loading programs...</span>
                  )}
                </div>

                {selectedProgram && (
                  <div className="semester-filter">
                    <span>Semester:</span>
                    <button
                      className={`filter-btn ${semesterFilter === '' ? 'active' : ''}`}
                      onClick={() => handleSemesterChange('')}
                    >
                      All Semesters
                    </button>

                    {semesters.length > 0 ? (
                      semesters.map((sem) => (
                        <button
                          key={sem}
                          className={`filter-btn ${semesterFilter === String(sem) ? 'active' : ''}`}
                          onClick={() => handleSemesterChange(String(sem))}
                        >
                          Sem {sem}
                        </button>
                      ))
                    ) : (
                      <span className="filter-loading">Loading semesters...</span>
                    )}
                  </div>
                )}

                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by name, enrollment, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="students-table-container">
                {loading ? (
                  <div className="loading">Loading students...</div>
                ) : error ? (
                  <div className="error-msg">{error}</div>
                ) : users.length === 0 ? (
                  <div className="no-students">
                    <span className="coming-icon">📊</span>
                    <h3>No Students Found</h3>
                    <p>No students match the current filters.</p>
                  </div>
                ) : (
                  <div className="students-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Enrollment</th>
                          <th>Program</th>
                          <th>Semester</th>
                          <th>Email</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="no-data">
                              {searchTerm ? 'No students match your search' : 'No students yet'}
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u, i) => (
                            <tr key={u._id}>
                              <td data-label="#">{i + 1}</td>
                              <td data-label="Name" className="name-cell">
                                {u.name}
                                {u.isBlocked && <span className="status-blocked-badge">Blocked</span>}
                              </td>
                              <td data-label="Enrollment" className="enrollment-cell">
                                {u.enrollmentNumber}
                              </td>
                              <td data-label="Program">
                                {u.course || '—'}
                              </td>
                              <td data-label="Semester">
                                {u.semester || '—'}
                              </td>
                              <td data-label="Email">{u.email || '—'}</td>
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminStudents;