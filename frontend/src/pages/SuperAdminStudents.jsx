
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';

const SuperAdminStudents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockingId, setBlockingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch all courses/programs
  const fetchCourses = async () => {
    try {
      const { data } = await API.get('/superadmin/courses');
      const courseList = Array.isArray(data?.courses) ? data.courses : [];
      setPrograms(courseList);
    } catch (err) {
      console.error('Failed to load courses:', err);
      setPrograms([]);
    }
  };

  // Fetch students
  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get('/superadmin/students');
      const studentList = Array.isArray(data?.users) ? data.users : [];
      setUsers(studentList);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      const msg = err.response?.data?.message || 'Failed to fetch students';
      setError(msg);
      toast.error(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Toggle block
  const handleToggleBlock = async (student) => {
    setBlockingId(student._id);
    try {
      const { data } = await API.put(`/superadmin/students/${student._id}/block`);
      toast.success(data.message || 'Student status updated');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student status');
    } finally {
      setBlockingId(null);
    }
  };

  // Delete student
  const handleDeleteStudent = async () => {
    if (!deleteConfirm) return;
    try {
      await API.delete(`/superadmin/students/${deleteConfirm.id}`);
      toast.success('Student account deleted successfully');
      setDeleteConfirm(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete student');
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchStudents();
  }, []);

  // Compute available semesters based on program selection
  const availableSemesters = (() => {
    if (selectedProgram) {
      const course = programs.find(
        (p) => p.code === selectedProgram || p.name === selectedProgram
      );
      if (course?.totalSemesters) {
        return Array.from({ length: course.totalSemesters }, (_, i) => String(i + 1));
      }
      const matching = users.filter(
        (s) =>
          s.course === selectedProgram ||
          (course && (s.course === course.name || s.course === course.code))
      );
      const sems = [...new Set(matching.map((s) => String(s.semester)).filter(Boolean))].sort(
        (a, b) => Number(a) - Number(b)
      );
      if (sems.length > 0) return sems;
    }
    return [...new Set(users.map((s) => String(s.semester)).filter(Boolean))].sort(
      (a, b) => Number(a) - Number(b)
    );
  })();

  // Filter students
  const filteredUsers = users.filter((student) => {
    if (student.role && student.role !== 'user') return false;

    if (searchTerm) {
      const search = searchTerm.toLowerCase().trim();
      const match =
        student.name?.toLowerCase().includes(search) ||
        student.enrollmentNumber?.toLowerCase().includes(search) ||
        student.email?.toLowerCase().includes(search) ||
        student.phone?.toLowerCase().includes(search) ||
        student.course?.toLowerCase().includes(search);
      if (!match) return false;
    }

    if (selectedProgram) {
      const selectedCourse = programs.find(
        (p) => p.code === selectedProgram || p.name === selectedProgram
      );
      const matchProg =
        student.course === selectedProgram ||
        (selectedCourse && (student.course === selectedCourse.name || student.course === selectedCourse.code));
      if (!matchProg) return false;
    }

    if (semesterFilter) {
      if (String(student.semester) !== String(semesterFilter)) return false;
    }

    return true;
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>

          {/* Navigation Bar */}
          <nav className="dashboard-nav" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span className="admin-badge">SUPER ADMIN PANEL</span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/superadmin-dashboard')}
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                ← Back to Dashboard
              </button>
            </div>
            <div className="nav-welcome">
              Welcome, {user?.name || 'Super Admin'}
            </div>
          </nav>

          {/* Main Content */}
          <div className="dashboard-content">
            <div className="admin-section students-page">

              {/* Page Header */}
              <div className="section-header-row">
                <div>
                  <h2>All Students</h2>
                  <p>Manage, view, and control all student accounts across all university programs</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={fetchStudents}
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Stats Overview */}
              <div className="stats-row">
                <div className="stat-card stat-blue">
                  <span className="stat-number">{filteredUsers.length}</span>
                  <span className="stat-label">Students Shown</span>
                </div>
                <div className="stat-card stat-green">
                  <span className="stat-number">{users.length}</span>
                  <span className="stat-label">Total Registered</span>
                </div>
                <div className="stat-card stat-purple">
                  <span className="stat-number">{programs.length}</span>
                  <span className="stat-label">Total Programs</span>
                </div>
              </div>

              {/* Filters Section */}
              <div className="filters-panel">
                {/* Program Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Program</label>
                  <select
                    className="filter-select"
                    value={selectedProgram}
                    onChange={(e) => {
                      setSelectedProgram(e.target.value);
                      setSemesterFilter('');
                    }}
                  >
                    <option value="">All Programs</option>
                    {programs.map((p) => (
                      <option key={p._id || p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Semester Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Semester</label>
                  <select
                    className="filter-select"
                    value={semesterFilter}
                    onChange={(e) => setSemesterFilter(e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {availableSemesters.map((sem) => (
                      <option key={sem} value={String(sem)}>
                        Semester {sem}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="filter-group search-group">
                  <label className="filter-label">Search</label>
                  <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="filter-select search-input"
                      placeholder="Search by name, enrollment, email, phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#999'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Reset Filters */}
                {(selectedProgram || semesterFilter || searchTerm) && (
                  <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ height: '42px', marginTop: 'auto' }}
                      onClick={() => {
                        setSelectedProgram('');
                        setSemesterFilter('');
                        setSearchTerm('');
                      }}
                    >
                      ↺ Reset Filters
                    </button>
                  </div>
                )}
              </div>

              {/* Students Table */}
              <div className="table-wrapper">
                {loading ? (
                  <div className="loading-state" style={{ padding: '60px', textAlign: 'center' }}>
                    <div className="spinner"></div>
                    <p>Loading students...</p>
                  </div>
                ) : error ? (
                  <div className="error-state" style={{ padding: '40px', textAlign: 'center' }}>
                    <span className="error-icon" style={{ fontSize: '36px' }}>⚠️</span>
                    <p>{error}</p>
                    <button className="btn btn-primary" onClick={fetchStudents}>Retry</button>
                  </div>
                ) : users.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px', textAlign: 'center' }}>
                    <span className="empty-icon" style={{ fontSize: '48px' }}>👥</span>
                    <h3>No Students Found</h3>
                    <p>No student accounts currently exist in the database.</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="empty-state" style={{ padding: '60px', textAlign: 'center' }}>
                    <span className="empty-icon" style={{ fontSize: '48px' }}>🔍</span>
                    <h3>No Matching Students</h3>
                    <p>No students match your current filter or search criteria.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Enrollment</th>
                          <th>Program</th>
                          <th>Semester</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th className="actions-header">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredUsers.map((student, index) => (
                          <tr key={student._id || student.enrollmentNumber || index}>
                            <td data-label="#" className="serial-col">
                              {index + 1}
                            </td>
                            <td data-label="Name" className="name-col">
                              <div className="student-info">
                                <span className="student-name">{student.name || '—'}</span>
                                {student.isBlocked && (
                                  <span className="status-badge blocked">Blocked</span>
                                )}
                              </div>
                            </td>
                            <td data-label="Enrollment" className="enrollment-col">
                              <code>{student.enrollmentNumber || '—'}</code>
                            </td>
                            <td data-label="Program" className="program-col">
                              <span className="program-badge">{student.course || '—'}</span>
                            </td>
                            <td data-label="Semester" className="sem-col">
                              <span className="semester-badge">Sem {student.semester || '—'}</span>
                            </td>
                            <td data-label="Email" className="email-col">
                              {student.email || '—'}
                            </td>
                            <td data-label="Phone" className="phone-col">
                              {student.phone || '—'}
                            </td>
                            <td data-label="Status" className="status-col">
                              <span className={`status-badge ${student.isBlocked ? 'blocked' : 'active'}`}>
                                {student.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                            </td>
                            <td data-label="Actions" className="actions-col">
                              <div className="action-buttons">
                                <button
                                  type="button"
                                  className={`action-btn ${student.isBlocked ? 'unblock' : 'block'}`}
                                  title={student.isBlocked ? 'Unblock Student' : 'Block Student'}
                                  disabled={blockingId === student._id}
                                  onClick={() => handleToggleBlock(student)}
                                >
                                  {blockingId === student._id ? '⏳' : (student.isBlocked ? '✅' : '🚫')}
                                </button>
                                <button
                                  type="button"
                                  className="action-btn delete"
                                  title="Delete Student"
                                  onClick={() => setDeleteConfirm({ id: student._id, name: student.name })}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredUsers.length > 0 && (
                  <div className="table-footer">
                    <span className="results-count">
                      Showing {filteredUsers.length} of {users.length} students
                    </span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="delete-msg">
                Are you sure you want to delete student <strong>{deleteConfirm.name}</strong>?
              </p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteStudent}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminStudents;
