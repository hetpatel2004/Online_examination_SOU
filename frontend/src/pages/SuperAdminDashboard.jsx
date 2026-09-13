import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import API from '../api/axios';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [assignCourseFilter, setAssignCourseFilter] = useState('');

  const getSemesterOptions = (courseCode) => {
    const course = courses.find(c => c.code === courseCode);
    const total = course?.totalSemesters || 4;
    return Array.from({ length: total }, (_, i) => i + 1);
  };

  // Stats
  const [stats, setStats] = useState({ totalAdmins: 0, totalStudents: 0, totalSubjects: 0, assignedSubjects: 0, totalCourses: 0 });

  // Admins
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Students
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentProgramFilter, setStudentProgramFilter] = useState('');
  const [studentSemesterFilter, setStudentSemesterFilter] = useState('');
  const [blockingStudentId, setBlockingStudentId] = useState(null);

  // Courses
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Subjects
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Assignment
  const [assignSubjects, setAssignSubjects] = useState([]);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [assignTab, setAssignTab] = useState('subject');
  const [assignSemesterFilter, setAssignSemesterFilter] = useState('');

  // Shared modal/form state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'admin', 'course', 'subject'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (activePage === 'dashboard') fetchStats();
    if (activePage === 'admins') { fetchAdmins(); fetchCourses(); }
    if (activePage === 'students') { fetchStudents(); fetchCourses(); }
    if (activePage === 'courses') fetchCourses();
    if (activePage === 'subjects') { fetchSubjects(); fetchCourses(); }
    if (activePage === 'assignment') { fetchAssignSubjects(); fetchAdmins(); fetchCourses(); }
  }, [activePage]);

  // ========== FETCH ==========
  const fetchStats = async () => {
    try { const { data } = await API.get('/superadmin/stats'); setStats(data); } catch {}
  };
  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try { const { data } = await API.get('/superadmin/admins'); setAdmins(data.admins || []); } catch { toast.error('Failed to load admins'); }
    setLoadingAdmins(false);
  };
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data } = await API.get('/superadmin/students');
      setStudents(data.users || []);
    } catch {
      toast.error('Failed to load students');
    }
    setLoadingStudents(false);
  };
  const handleToggleBlockStudent = async (student) => {
    setBlockingStudentId(student._id);
    try {
      const { data } = await API.put(`/superadmin/students/${student._id}/block`);
      toast.success(data.message || 'Student status updated');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student status');
    } finally {
      setBlockingStudentId(null);
    }
  };
  const fetchCourses = async () => {
    setLoadingCourses(true);
    try { const { data } = await API.get('/superadmin/courses'); setCourses(data.courses || []); } catch { toast.error('Failed to load programs'); }
    setLoadingCourses(false);
  };
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try { const { data } = await API.get('/superadmin/subjects'); setSubjects(data.subjects || []); } catch { toast.error('Failed to load subjects'); }
    setLoadingSubjects(false);
  };
  const fetchAssignSubjects = async () => {
    setLoadingAssignment(true);
    try { const { data } = await API.get('/superadmin/subjects'); setAssignSubjects(data.subjects || []); } catch { toast.error('Failed to load subjects'); }
    setLoadingAssignment(false);
  };

  // ========== MODAL HELPERS ==========
  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setFormError('');
    const defaultCourse = courses.length > 0 ? courses[0].code : '';

    if (type === 'admin') {
      setFormData(item ? { name: item.name, enrollmentNumber: item.enrollmentNumber, email: item.email, phone: item.phone, course: item.course || defaultCourse, semester: item.semester || 'N/A', password: '' }
        : { name: '', enrollmentNumber: '', email: '', phone: '', course: defaultCourse, semester: 'N/A', password: '' });
    } else if (type === 'course') {
      setFormData(item ? { name: item.name, code: item.code, description: item.description || '', level: item.level || 'postgraduation' }
        : { name: '', code: '', description: '', level: 'postgraduation' });
    } else if (type === 'subject') {
      setFormData(item ? { name: item.name, code: item.code, semester: String(item.semester), course: item.course, description: item.description || '' }
        : { name: '', code: '', semester: '1', course: defaultCourse, description: '' });
      if (!item) fetchCourses();
    }

    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingItem(null); setFormData({}); setFormError(''); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'course') {
      const total = courses.find(c => c.code === value)?.totalSemesters || 4;
      setFormData(prev => ({
        ...prev,
        course: value,
        semester: prev.semester !== 'N/A' && Number(prev.semester) > total ? '1' : prev.semester
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // ========== FORM SUBMIT ==========
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (modalType === 'admin') {
        if (editingItem) {
          toast.success('Admin updated!');
        } else {
          await API.post('/superadmin/admins', formData);
          toast.success(`Admin created! Credentials being emailed to ${formData.credentialsEmail || formData.email}`);
        }
        closeModal();
        fetchAdmins();
      } else if (modalType === 'course') {
        if (editingItem) {
          await API.put(`/superadmin/courses/${editingItem._id}`, formData);
          toast.success('Program updated!');
        } else {
          await API.post('/superadmin/courses', formData);
          toast.success('Program created!');
        }
        closeModal();
        fetchCourses();
      } else if (modalType === 'subject') {
        if (editingItem) {
          await API.put(`/superadmin/subjects/${editingItem._id}`, formData);
          toast.success('Subject updated!');
        } else {
          await API.post('/superadmin/subjects', formData);
          toast.success('Subject created!');
        }
        closeModal();
        fetchSubjects();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed');
    }
    setFormLoading(false);
  };

  // ========== DELETE ==========
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'admin') {
        await API.delete(`/superadmin/admins/${deleteConfirm.id}`);
        toast.success('Admin deleted');
        fetchAdmins();
      } else if (deleteConfirm.type === 'course') {
        await API.delete(`/superadmin/courses/${deleteConfirm.id}`);
        toast.success('Program deleted');
        fetchCourses();
      } else if (deleteConfirm.type === 'subject') {
        await API.delete(`/superadmin/subjects/${deleteConfirm.id}`);
        toast.success('Subject deleted');
        fetchSubjects();
      } else if (deleteConfirm.type === 'student') {
        await API.delete(`/superadmin/students/${deleteConfirm.id}`);
        toast.success('Student deleted');
        fetchStudents();
        fetchStats();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setDeleteConfirm(null);
  };

  // ========== ASSIGNMENT ==========
  const handleAssignSubject = async (subjectId, adminId, action) => {
    try {
      await API.put(`/superadmin/subjects/${subjectId}/assign`, { adminId, action });
      toast.success(action === 'remove' ? 'Admin removed from subject' : 'Admin assigned to subject');
      fetchAssignSubjects();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ========== FILTERED ==========
  const filteredSubjects = semesterFilter ? subjects.filter(s => s.semester === Number(semesterFilter)) : subjects;

  // ========== RENDER ==========
  const renderPage = () => {
    switch (activePage) {
      case 'admins': return renderAdmins();
      case 'students': return renderStudents();
      case 'courses': return renderCourses();
      case 'subjects': return renderSubjects();
      case 'assignment': return renderAssignment();
      default: return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      <div className="welcome-section admin-welcome">
        <h1>Welcome, Super Admin {user?.name}!</h1>
        <p>Enrollment: {user?.enrollmentNumber} | Role: {user?.role?.toUpperCase()}</p>
      </div>
      <div className="stats-row">
        <div className="stat-card stat-blue"><span className="stat-number">{stats.totalAdmins}</span><span className="stat-label">Admins</span></div>
        <div className="stat-card stat-green clickable" style={{ cursor: 'pointer' }} title="Click to view all students" onClick={() => setActivePage('students')}><span className="stat-number">{stats.totalStudents}</span><span className="stat-label">Students</span></div>
        <div className="stat-card stat-purple"><span className="stat-number">{stats.totalCourses}</span><span className="stat-label">Programs</span></div>
        <div className="stat-card stat-orange"><span className="stat-number">{stats.totalSubjects}</span><span className="stat-label">Subjects</span></div>
        <div className="stat-card stat-blue"><span className="stat-number">{stats.assignedSubjects}</span><span className="stat-label">Assigned</span></div>
      </div>
      <div className="student-info">
        <h2>Super Admin Profile</h2>
        <div className="info-grid">
          <div className="info-item"><label>Name</label><span>{user?.name}</span></div>
          <div className="info-item"><label>Enrollment No</label><span>{user?.enrollmentNumber}</span></div>
          <div className="info-item"><label>Role</label><span className="role-badge">{user?.role?.toUpperCase()}</span></div>
          <div className="info-item"><label>Access Level</label><span>Full System Access</span></div>
        </div>
      </div>
      <div className="subjects-section">
        <h2>Quick Actions</h2>
        <div className="subjects-grid">
          <div className="subject-card admin-card clickable" onClick={() => setActivePage('admins')}>
            <div className="subject-icon">👤</div><h3>Manage Admins</h3><p>Create, view, and remove admin accounts</p>
          </div>
          <div className="subject-card admin-card clickable" onClick={() => setActivePage('students')}>
            <div className="subject-icon">👥</div><h3>Manage Students</h3><p>View, filter, and manage all student accounts</p>
          </div>
          <div className="subject-card admin-card clickable" onClick={() => setActivePage('courses')}>
            <div className="subject-icon">🎓</div><h3>Manage Programs</h3><p>Add, edit, or remove programs</p>
          </div>
          <div className="subject-card admin-card clickable" onClick={() => setActivePage('subjects')}>
            <div className="subject-icon">📚</div><h3>Manage Subjects</h3><p>Add, edit, or remove subjects by semester</p>
          </div>
          <div className="subject-card admin-card clickable" onClick={() => setActivePage('assignment')}>
            <div className="subject-icon">🔗</div><h3>Assign Faculty</h3><p>Assign admins to teach specific subjects</p>
          </div>
        </div>
      </div>
    </>
  );

  const renderStudents = () => {
    const filteredStudents = students.filter((s) => {
      if (s.role && s.role !== 'user') return false;

      if (studentSearch) {
        const term = studentSearch.toLowerCase().trim();
        const match =
          s.name?.toLowerCase().includes(term) ||
          s.enrollmentNumber?.toLowerCase().includes(term) ||
          s.email?.toLowerCase().includes(term) ||
          s.phone?.toLowerCase().includes(term) ||
          s.course?.toLowerCase().includes(term);
        if (!match) return false;
      }

      if (studentProgramFilter) {
        const selectedCourse = courses.find(
          (c) => c.code === studentProgramFilter || c.name === studentProgramFilter
        );
        const matchProg =
          s.course === studentProgramFilter ||
          (selectedCourse && (s.course === selectedCourse.name || s.course === selectedCourse.code));
        if (!matchProg) return false;
      }

      if (studentSemesterFilter) {
        if (String(s.semester) !== String(studentSemesterFilter)) return false;
      }

      return true;
    });

    const availableSemesters = (() => {
      if (studentProgramFilter) {
        const course = courses.find((c) => c.code === studentProgramFilter || c.name === studentProgramFilter);
        if (course?.totalSemesters) {
          return Array.from({ length: course.totalSemesters }, (_, i) => String(i + 1));
        }
        const matching = students.filter(
          (s) =>
            s.course === studentProgramFilter ||
            (course && (s.course === course.name || s.course === course.code))
        );
        const sems = [...new Set(matching.map((s) => String(s.semester)).filter(Boolean))].sort(
          (a, b) => Number(a) - Number(b)
        );
        if (sems.length > 0) return sems;
      }
      return [...new Set(students.map((s) => String(s.semester)).filter(Boolean))].sort(
        (a, b) => Number(a) - Number(b)
      );
    })();

    return (
      <div className="admin-section students-page">
        <div className="section-header-row">
          <div>
            <h2>Manage Students</h2>
            <p>View, search, and manage all student accounts across programs</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card stat-blue">
            <span className="stat-number">{filteredStudents.length}</span>
            <span className="stat-label">Students Shown</span>
          </div>
          <div className="stat-card stat-green">
            <span className="stat-number">{students.length}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>

        <div className="filters-panel">
          <div className="filter-group">
            <label className="filter-label">Program</label>
            <select
              className="filter-select"
              value={studentProgramFilter}
              onChange={(e) => {
                setStudentProgramFilter(e.target.value);
                setStudentSemesterFilter('');
              }}
            >
              <option value="">All Programs</option>
              {courses.map((c) => (
                <option key={c._id} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Semester</label>
            <select
              className="filter-select"
              value={studentSemesterFilter}
              onChange={(e) => setStudentSemesterFilter(e.target.value)}
            >
              <option value="">All Semesters</option>
              {availableSemesters.map((sem) => (
                <option key={sem} value={String(sem)}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <div className="filter-group search-group">
            <label className="filter-label">Search</label>
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="filter-select search-input"
                placeholder="Search by name, enrollment, email, phone..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
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

          {(studentProgramFilter || studentSemesterFilter || studentSearch) && (
            <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', marginTop: 'auto' }}
                onClick={() => {
                  setStudentProgramFilter('');
                  setStudentSemesterFilter('');
                  setStudentSearch('');
                }}
              >
                ↺ Reset Filters
              </button>
            </div>
          )}
        </div>

        {loadingStudents ? (
          <div className="loading">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="coming-soon" style={{ padding: '40px' }}>
            <span className="coming-icon">👥</span>
            <h3>No Students Found</h3>
            <p>No student accounts found in the database.</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="coming-soon" style={{ padding: '40px' }}>
            <span className="coming-icon">🔍</span>
            <h3>No Matching Students</h3>
            <p>Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <div className="table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Enrollment</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Program</th>
                    <th>Sem</th>
                    <th>Status</th>
                    <th className="actions-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, i) => (
                    <tr key={s._id}>
                      <td data-label="#" className="serial-col">{i + 1}</td>
                      <td data-label="Name" className="name-col">
                        <div className="student-info">
                          <span className="student-name">{s.name}</span>
                          {s.isBlocked && <span className="status-badge blocked">Blocked</span>}
                        </div>
                      </td>
                      <td data-label="Enrollment" className="enrollment-col">
                        <code>{s.enrollmentNumber}</code>
                      </td>
                      <td data-label="Email" className="email-col">{s.email || '—'}</td>
                      <td data-label="Phone" className="phone-col">{s.phone || '—'}</td>
                      <td data-label="Program" className="program-col">
                        <span className="program-badge">{s.course || '—'}</span>
                      </td>
                      <td data-label="Sem" className="sem-col">
                        <span className="semester-badge">Sem {s.semester || '—'}</span>
                      </td>
                      <td data-label="Status" className="status-col">
                        <span className={`status-badge ${s.isBlocked ? 'blocked' : 'active'}`}>
                          {s.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td data-label="Actions" className="actions-col">
                        <div className="action-buttons">
                          <button
                            className={`action-btn ${s.isBlocked ? 'unblock' : 'block'}`}
                            title={s.isBlocked ? 'Unblock Student' : 'Block Student'}
                            disabled={blockingStudentId === s._id}
                            onClick={() => handleToggleBlockStudent(s)}
                          >
                            {blockingStudentId === s._id ? '⏳' : (s.isBlocked ? '✅' : '🚫')}
                          </button>
                          <button
                            className="action-btn delete"
                            title="Delete Student"
                            onClick={() => setDeleteConfirm({ type: 'student', id: s._id, name: s.name })}
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
            <div className="table-footer">
              <span className="results-count">
                Showing {filteredStudents.length} of {students.length} students
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdmins = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>Manage Admins</h2>
          <p>Create, view, and remove admin accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('admin')}>+ Create Admin</button>
      </div>
      <div className="stats-row">
        <div className="stat-card stat-blue"><span className="stat-number">{admins.length}</span><span className="stat-label">Admins</span></div>
      </div>
      {loadingAdmins ? <div className="loading">Loading admins...</div> : admins.length === 0 ? (
        <div className="coming-soon" style={{ padding: '40px' }}><span className="coming-icon">👤</span><h3>No Admins</h3><p>Create your first admin account.</p></div>
      ) : (
        <div className="table-container"><table className="users-table"><thead><tr><th>#</th><th>Name</th><th>Enrollment</th><th>Email</th><th>Phone</th><th>Program</th><th>Actions</th></tr></thead><tbody>
          {admins.map((a, i) => (<tr key={a._id}><td data-label="#">{i + 1}</td><td data-label="Name" className="name-cell"><strong>{a.name}</strong></td><td data-label="Enrollment" className="enrollment-cell"><code>{a.enrollmentNumber}</code></td><td data-label="Email">{a.email}</td><td data-label="Phone">{a.phone}</td><td data-label="Program">{a.course}</td><td data-label="Actions" className="actions-cell"><button className="btn-icon btn-delete" title="Delete" onClick={() => setDeleteConfirm({ type: 'admin', id: a._id, name: a.name })}>🗑️</button></td></tr>))}
        </tbody></table></div>
      )}
    </div>
  );

  const renderCourses = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>Manage Programs</h2>
          <p>Add, edit, and remove programs</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('course')}>+ Add Program</button>
      </div>
      <div className="stats-row">
        <div className="stat-card stat-purple"><span className="stat-number">{courses.length}</span><span className="stat-label">Programs</span></div>
      </div>
      {loadingCourses ? <div className="loading">Loading programs...</div> : courses.length === 0 ? (
        <div className="coming-soon" style={{ padding: '40px' }}><span className="coming-icon">🎓</span><h3>No Programs</h3><p>Add your first program.</p></div>
      ) : (
        <div className="table-container"><table className="users-table"><thead><tr><th>#</th><th>Code</th><th>Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>
          {courses.map((c, i) => (<tr key={c._id}><td>{i + 1}</td><td className="enrollment-cell"><code>{c.code}</code></td><td className="name-cell"><strong>{c.name}</strong></td><td>{c.description || '—'}</td><td className="actions-cell">
            <button className="btn-icon btn-edit" title="Edit" onClick={() => openModal('course', c)}>✏️</button>
            <button className="btn-icon btn-delete" title="Delete" onClick={() => setDeleteConfirm({ type: 'course', id: c._id, name: c.name })}>🗑️</button>
          </td></tr>))}
        </tbody></table></div>
      )}
    </div>
  );

  const renderSubjects = () => {
    const semesters = [...new Set(subjects.map(s => s.semester))].sort((a, b) => a - b);
    return (
      <div className="admin-section">
        <div className="section-header-row">
          <div>
            <h2>Manage Subjects</h2>
            <p>Add, edit, and remove subjects by semester</p>
          </div>
          <button className="btn btn-primary" onClick={() => openModal('subject')}>+ Add Subject</button>
        </div>
        <div className="stats-row">
          <div className="stat-card stat-orange"><span className="stat-number">{subjects.length}</span><span className="stat-label">Subjects</span></div>
          <div className="stat-card stat-blue"><span className="stat-number">{subjects.filter(s => s.assignedTo && s.assignedTo.length > 0).length}</span><span className="stat-label">Assigned</span></div>
        </div>
        {semesters.length > 0 && (
          <div className="filter-row">
            <button className={`filter-btn ${semesterFilter === '' ? 'active' : ''}`} onClick={() => setSemesterFilter('')}>All</button>
            {semesters.map(sem => (
              <button key={sem} className={`filter-btn ${semesterFilter === String(sem) ? 'active' : ''}`} onClick={() => setSemesterFilter(String(sem))}>Sem {sem}</button>
            ))}
          </div>
        )}
        {loadingSubjects ? <div className="loading">Loading subjects...</div> : filteredSubjects.length === 0 ? (
          <div className="coming-soon" style={{ padding: '40px' }}><span className="coming-icon">📚</span><h3>No Subjects</h3><p>Add your first subject.</p></div>
        ) : (
          <div className="table-container"><table className="users-table subject-table"><thead><tr><th>#</th><th>Code</th><th>Name</th><th>Program</th><th>Sem</th><th>Assigned To</th><th>Actions</th></tr></thead><tbody>
            {filteredSubjects.map((s, i) => {
              const assignedList = Array.isArray(s.assignedTo) ? s.assignedTo : (s.assignedTo ? [s.assignedTo] : []);
              return (<tr key={s._id}><td>{i + 1}</td><td className="enrollment-cell"><code>{s.code}</code></td><td className="name-cell"><strong>{s.name}</strong></td><td>{s.course}</td><td><span className="semester-tag">Sem {s.semester}</span></td><td><div className="faculty-tags-wrap">{assignedList.length > 0 ? assignedList.map(a => <span key={a._id} className="assigned-faculty">{a.name}</span>) : <span className="unassigned-tag">Unassigned</span>}</div></td><td className="actions-cell">
              <button className="btn-icon btn-edit" title="Edit" onClick={() => openModal('subject', s)}>✏️</button>
              <button className="btn-icon btn-delete" title="Delete" onClick={() => setDeleteConfirm({ type: 'subject', id: s._id, name: s.name })}>🗑️</button>
            </td></tr>);
            })}
          </tbody></table></div>
        )}
      </div>
    );
  };

  const renderAssignment = () => {
    const filtered = assignCourseFilter ? assignSubjects.filter(s => s.course === assignCourseFilter) : assignSubjects;
    const grouped = {};
    filtered.forEach(s => {
      const key = `${s.course} - Semester ${s.semester}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    return (
      <div className="admin-section">
        <div className="section-header-row">
          <div>
            <h2>Assign Faculty to Subjects</h2>
            <p>Select which admin(s) teach each subject</p>
          </div>
        </div>
        {courses.length > 0 && (
          <div className="filter-row">
            <button className={`filter-btn ${assignCourseFilter === '' ? 'active' : ''}`} onClick={() => setAssignCourseFilter('')}>All Programs</button>
            {courses.map(c => (
              <button key={c._id} className={`filter-btn ${assignCourseFilter === c.code ? 'active' : ''}`} onClick={() => setAssignCourseFilter(c.code)}>{c.code}</button>
            ))}
          </div>
        )}
        {loadingAssignment ? <div className="loading">Loading assignments...</div> : Object.keys(grouped).length === 0 ? (
          <div className="coming-soon" style={{ padding: '40px' }}><span className="coming-icon">🔗</span><h3>No Subjects</h3><p>Create subjects first, then assign faculty.</p></div>
        ) : (
          Object.entries(grouped).map(([group, subs]) => (
            <div key={group} className="assignment-group">
              <h3 className="assignment-group-title">{group}</h3>
              <div className="table-container"><table className="users-table"><thead><tr><th>Code</th><th>Subject</th><th>Assigned Faculty</th><th>Action</th></tr></thead><tbody>
                {subs.map(s => {
                  const assignedList = Array.isArray(s.assignedTo) ? s.assignedTo : (s.assignedTo ? [s.assignedTo] : []);
                  const assignedIds = assignedList.map(a => a?._id || a);
                  const availableAdmins = admins.filter(a => !assignedIds.includes(a._id));
                  return (
                    <tr key={s._id}><td className="enrollment-cell"><code>{s.code}</code></td><td className="name-cell"><strong>{s.name}</strong></td>
                      <td>
                        <div className="faculty-tags-wrap">
                        {assignedList.length > 0 ? assignedList.map(a => (
                          <span key={a._id} className="assigned-faculty">
                            {a.name} ({a.enrollmentNumber})
                            <button className="faculty-remove-btn" onClick={() => handleAssignSubject(s._id, a._id, 'remove')} title="Remove">✕</button>
                          </span>
                        )) : <span className="unassigned-tag">Not assigned</span>}
                        </div>
                      </td>
                      <td>
                        {availableAdmins.length > 0 ? (
                          <select className="assign-select" value="" onChange={(e) => { if (e.target.value) handleAssignSubject(s._id, e.target.value, 'add'); }}>
                            <option value="">+ Add Faculty</option>
                            {availableAdmins.map(a => <option key={a._id} value={a._id}>{a.name} ({a.enrollmentNumber})</option>)}
                          </select>
                        ) : <span className="faculty-all-assigned">All admins assigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody></table></div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-page dashboard-layout">
      <Sidebar role="superadmin" activePage={activePage} onNavigate={setActivePage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <nav className="dashboard-nav">
          <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
          <div className="nav-brand"><span className="admin-badge">SUPER ADMIN PANEL</span></div>
          <div className="nav-welcome">Welcome, {user?.name}</div>
        </nav>
        <div className="dashboard-content">{renderPage()}</div>
      </div>

      {/* ========== ADD/EDIT MODAL ========== */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? `Edit ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}` : `Create ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && <div className="error-msg">{formError}</div>}

                {/* ADMIN FORM */}
                {modalType === 'admin' && (
                  <>
                    <div className="form-row">
                      <div className="form-group"><label>Full Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="Dr. John Doe" /></div>
                      <div className="form-group"><label>Admin Login ID</label><input type="text" name="enrollmentNumber" value={formData.enrollmentNumber || ''} onChange={handleInputChange} required placeholder="ADMIN004" disabled={!!editingItem} /><span className="field-hint"></span></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} required placeholder="admin4@sou.edu" /></div>
                      <div className="form-group"><label>Phone</label><input type="text" name="phone" value={formData.phone || ''} onChange={handleInputChange} required placeholder="9876543210" /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Program</label><select name="course" value={formData.course || 'MCA'} onChange={handleInputChange} required>{courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}<option value="Administration">Administration</option></select></div>
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || 'N/A'} onChange={handleInputChange} required><option value="N/A">All Semesters</option>{getSemesterOptions(formData.course).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>
                    {!editingItem && <div className="form-group"><label>Password</label><input type="password" name="password" value={formData.password || ''} onChange={handleInputChange} required minLength="6" placeholder="Min 6 characters" /></div>}
                    {!editingItem && <div className="form-group"><label>Credentials Email (login ID &amp; password are mailed here)</label><input type="email" name="credentialsEmail" value={formData.credentialsEmail || ''} onChange={handleInputChange} placeholder="e.g. admin4@sou.edu — blank sends to the Email above" /></div>}
                    {editingItem && <div className="form-group"><label>New Password (leave blank to keep)</label><input type="password" name="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Optional" /></div>}
                  </>
                )}

                {/* COURSE FORM */}
                {modalType === 'course' && (
                  <>
                    <div className="form-row">
                      <div className="form-group"><label>Program Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="Master of Computer Applications" /></div>
                      <div className="form-group"><label>Program Code</label><input type="text" name="code" value={formData.code || ''} onChange={handleInputChange} required placeholder="MCA" disabled={!!editingItem} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Level</label>
                        <select name="level" value={formData.level || 'postgraduation'} onChange={handleInputChange} required>
                          <option value="graduation">Graduation (1-6 Semesters)</option>
                          <option value="postgraduation">Post Graduation (1-4 Semesters)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Total Semesters</label>
                        <input type="number" name="totalSemesters" value={formData.level === 'graduation' ? 6 : 4} readOnly style={{ background: '#f5f5f5' }} />
                        <span className="field-hint">{formData.level === 'graduation' ? '6 semesters for graduation' : '4 semesters for post graduation'}</span>
                      </div>
                    </div>
                    <div className="form-group"><label>Description</label><input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Optional description" /></div>
                  </>
                )}

                {/* SUBJECT FORM */}
                {modalType === 'subject' && (
                  <>
                    <div className="form-row">
                      <div className="form-group"><label>Subject Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="Advanced Web Technologies" /></div>
                      <div className="form-group"><label>Subject Code</label><input type="text" name="code" value={formData.code || ''} onChange={handleInputChange} required placeholder="MCA401" disabled={!!editingItem} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Program</label><select name="course" value={formData.course || ''} onChange={handleInputChange} required>{courses.length > 0 ? courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>) : <option value="">Loading programs...</option>}</select></div>
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || '1'} onChange={handleInputChange} required>{getSemesterOptions(formData.course).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>
                    <div className="form-group"><label>Description</label><input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Optional description" /></div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>{formLoading ? 'Saving...' : editingItem ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== DELETE CONFIRMATION MODAL ========== */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="delete-msg">Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
              <p className="delete-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;