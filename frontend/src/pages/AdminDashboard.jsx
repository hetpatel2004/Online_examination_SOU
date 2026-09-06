import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import ExamCalendar from '../components/ExamCalendar';
import API from '../api/axios';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Dashboard stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSubjects: 0,
    totalExams: 0,
    upcomingExams: 0
  });

  // Subjects
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectError, setSubjectError] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');

  // Exams
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examError, setExamError] = useState('');

  // Courses for filters
  const [courses, setCourses] = useState([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch functions
  const fetchStats = async () => {
    try {
      const [studentsRes, subjectsRes, examsRes] = await Promise.all([
        API.get('/admin/users', { params: { role: 'user' } }),
        API.get('/admin/subjects'),
        API.get('/admin/exams')
      ]);
      setStats({
        totalStudents: studentsRes.data.users?.length || 0,
        totalSubjects: subjectsRes.data.subjects?.length || 0,
        totalExams: examsRes.data.exams?.length || 0,
        upcomingExams: examsRes.data.exams?.filter(e => getExamStatus(e) === 'upcoming').length || 0
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await API.get('/admin/programs');
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  };

  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    setSubjectError('');
    try {
      const { data } = await API.get('/admin/subjects');
      setSubjects(data.subjects || []);
    } catch (err) {
      setSubjectError(err.response?.data?.message || 'Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    setExamError('');
    try {
      const { data } = await API.get('/admin/exams');
      setExams(data.exams || []);
    } catch (err) {
      setExamError(err.response?.data?.message || 'Failed to load exams');
    } finally {
      setLoadingExams(false);
    }
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const examStart = new Date(`${exam.date}T${exam.time}`);
    const examEnd = new Date(examStart.getTime() + (exam.duration || 60) * 60000);
    if (now < examStart) return 'upcoming';
    if (now >= examStart && now <= examEnd) return 'ongoing';
    return 'completed';
  };

  const getSemesterOptions = (courseCode) => {
    const course = courses.find(c => c.code === courseCode);
    const total = course?.totalSemesters || 4;
    return Array.from({ length: total }, (_, i) => i + 1);
  };

  // Modal helpers
  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    setFormError('');
    const defaultCourse = courses.length > 0 ? courses[0].code : '';

    if (type === 'subject') {
      setFormData(item ? { 
        name: item.name, 
        code: item.code, 
        semester: String(item.semester), 
        course: item.course, 
        description: item.description || '' 
      } : { name: '', code: '', semester: '1', course: defaultCourse, description: '' });
      if (!item) fetchCourses();
    } else if (type === 'exam') {
      setFormData(item ? { 
        subjectId: item.subjectId?._id || item.subjectId,
        date: item.date,
        time: item.time,
        duration: item.duration,
        totalMarks: item.totalMarks,
        examType: item.examType,
        semester: item.semester,
        course: item.course
      } : { subjectId: '', date: '', time: '', duration: 60, totalMarks: 100, examType: 'mcq', semester: '', course: '' });
      fetchSubjects();
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingItem(null); setFormData({}); setFormError(''); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'course') {
      const total = courses.find(c => c.code === value)?.totalSemesters || 4;
      setFormData(prev => ({ ...prev, course: value, semester: prev.semester && Number(prev.semester) > total ? '1' : prev.semester }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (modalType === 'subject') {
        if (editingItem) {
          await API.put(`/admin/subjects/${editingItem._id}`, formData);
          toast.success('Subject updated!');
        } else {
          await API.post('/admin/subjects', formData);
          toast.success('Subject created!');
        }
        closeModal();
        fetchSubjects();
      } else if (modalType === 'exam') {
        if (editingItem) {
          await API.put(`/admin/exams/${editingItem._id}`, formData);
          toast.success('Exam updated!');
        } else {
          await API.post('/admin/exams', formData);
          toast.success('Exam scheduled!');
        }
        closeModal();
        fetchExams();
        fetchStats();
      }
    } catch (error) {
      setFormError(error.response?.data?.message || 'Operation failed');
      toast.error(error.response?.data?.message || 'Failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'subject') {
        await API.delete(`/admin/subjects/${deleteConfirm.id}`);
        toast.success('Subject deleted');
        fetchSubjects();
      } else if (deleteConfirm.type === 'exam') {
        await API.delete(`/admin/exams/${deleteConfirm.id}`);
        toast.success('Exam deleted');
        fetchExams();
        fetchStats();
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    setDeleteConfirm(null);
  };

  useEffect(() => {
    fetchStats();
    fetchCourses();
    if (activePage === 'subjects') fetchSubjects();
    if (activePage === 'exams') fetchExams();
  }, [activePage]);

  // Render functions
  const renderDashboard = () => (
    <>
      <div className="welcome-section admin-welcome">
        <div className="welcome-content">
          <h1>Welcome, Admin {user?.name}! 👋</h1>
          <p className="welcome-subtitle">
            {user?.course || 'Administration'} • {user?.enrollmentNumber}
          </p>
        </div>
        <div className="welcome-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'A'}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-number">{stats.totalStudents}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <span className="stat-number">{stats.totalSubjects}</span>
            <span className="stat-label">Subjects</span>
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <span className="stat-number">{stats.totalExams}</span>
            <span className="stat-label">Total Exams</span>
          </div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <span className="stat-number">{stats.upcomingExams}</span>
            <span className="stat-label">Upcoming</span>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="section-card">
          <div className="section-header">
            <h2>📅 Upcoming Exams</h2>
            <button className="btn-ghost" onClick={() => setActivePage('exams')}>View All →</button>
          </div>
          {loadingExams ? (
            <div className="loading-skeleton">Loading...</div>
          ) : exams.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📝</span><p>No exams scheduled</p></div>
          ) : (
            <div className="exam-list">
              {exams.filter(e => getExamStatus(e) === 'upcoming').slice(0, 5).map((exam) => (
                <div key={exam._id} className="exam-item upcoming">
                  <div className="exam-item-icon">📋</div>
                  <div className="exam-item-info">
                    <h4>{exam.subjectName}</h4>
                    <p>{exam.subjectCode} • {exam.duration} min • {exam.totalMarks} marks</p>
                  </div>
                  <div className="exam-item-meta">
                    <span className="exam-date">📅 {exam.date}</span>
                    <span className="exam-time">🕐 {exam.time}</span>
                  </div>
                  <span className="status-badge status-upcoming">Upcoming</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-header">
            <h2>📚 My Subjects</h2>
            <button className="btn-ghost" onClick={() => setActivePage('subjects')}>View All →</button>
          </div>
          {loadingSubjects ? (
            <div className="loading-skeleton">Loading...</div>
          ) : subjects.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📋</span><p>No subjects assigned</p></div>
          ) : (
            <div className="subject-list">
              {subjects.slice(0, 5).map((s) => (
                <div key={s._id} className="subject-item">
                  <div className="subject-item-icon">{s.examType === 'practical' ? '💻' : '📖'}</div>
                  <div className="subject-item-info">
                    <h4>{s.name}</h4>
                    <p>{s.code} • Sem {s.semester} • {s.course}</p>
                  </div>
                  <span className="subject-type-badge">{s.examType === 'practical' ? 'Practical' : 'MCQ'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <button className="action-btn" onClick={() => setActivePage('exams')}>
            <span className="action-icon">📝</span><span>Manage Exams</span>
          </button>
          <button className="action-btn" onClick={() => setActivePage('subjects')}>
            <span className="action-icon">📚</span><span>Manage Subjects</span>
          </button>
          <button className="action-btn" onClick={() => setActivePage('timetable')}>
            <span className="action-icon">📅</span><span>Exam Timetable</span>
          </button>
          <button className="action-btn" onClick={() => setActivePage('change-password')}>
            <span className="action-icon">🔐</span><span>Change Password</span>
          </button>
        </div>
      </div>
    </>
  );

  const renderSubjects = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>Manage Subjects</h2>
          <p>Create, edit, and remove subjects</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('subject')}>+ Add Subject</button>
      </div>
      {loadingSubjects ? <div className="loading">Loading...</div> : subjectError ? <div className="error-msg">{subjectError}</div> : (
        <div className="table-container">
          <table className="users-table subject-table">
            <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Program</th><th>Sem</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan="7" className="no-data">No subjects found</td></tr>
              ) : subjects.map((s, i) => (
                <tr key={s._id}>
                  <td>{i + 1}</td>
                  <td className="name-cell">{s.name}</td>
                  <td className="enrollment-cell">{s.code}</td>
                  <td>{s.course}</td>
                  <td><span className="semester-tag">Sem {s.semester}</span></td>
                  <td><span className={`subject-type-badge ${s.examType === 'practical' ? 'practical' : 'mcq'}`}>{s.examType === 'practical' ? 'Practical' : 'MCQ'}</span></td>
                  <td className="actions-cell">
                    <button className="btn-icon btn-edit" onClick={() => openModal('subject', s)}>✏️</button>
                    <button className="btn-icon btn-delete" onClick={() => setDeleteConfirm({ type: 'subject', id: s._id, name: s.name })}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderExams = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>Schedule Exams</h2>
          <p>Create, update, and manage exam schedules</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('exam')}>+ Schedule Exam</button>
      </div>
      <div className="stats-row">
        <div className="stat-card stat-blue"><span className="stat-number">{exams.length}</span><span className="stat-label">Total Exams</span></div>
        <div className="stat-card stat-green"><span className="stat-number">{exams.filter(e => getExamStatus(e) === 'upcoming').length}</span><span className="stat-label">Upcoming</span></div>
        <div className="stat-card stat-purple"><span className="stat-number">{exams.filter(e => getExamStatus(e) === 'ongoing').length}</span><span className="stat-label">Live</span></div>
        <div className="stat-card stat-orange"><span className="stat-number">{exams.filter(e => getExamStatus(e) === 'completed').length}</span><span className="stat-label">Completed</span></div>
      </div>
      {loadingExams ? <div className="loading">Loading...</div> : examError ? <div className="error-msg">{examError}</div> : (
        <div className="exams-grid">
          {exams.length === 0 ? (
            <div className="coming-soon"><span className="coming-icon">📝</span><h3>No Exams</h3><p>Schedule your first exam.</p></div>
          ) : exams.map((exam) => {
            const status = getExamStatus(exam);
            return (
              <div className={`exam-card ${status === 'ongoing' ? 'card-live' : ''} ${status === 'completed' ? 'card-completed' : ''}`} key={exam._id}>
                <div className="exam-card-header">
                  <div className="exam-card-icon">{status === 'ongoing' ? '🔴' : status === 'completed' ? '✅' : '📋'}</div>
                  <div className="exam-card-title"><h3>{exam.subjectName}</h3><span className="exam-code">{exam.subjectCode}</span></div>
                  <span className={`exam-status ${status === 'ongoing' ? 'status-ongoing' : status === 'completed' ? 'status-completed' : 'status-upcoming'}`}>
                    {status === 'ongoing' ? 'LIVE' : status === 'completed' ? 'Completed' : 'Upcoming'}
                  </span>
                </div>
                <div className="exam-card-details">
                  <div className="exam-detail"><span>📅</span> {exam.date} at {exam.time}</div>
                  <div className="exam-detail"><span>⏱</span> {exam.duration} min</div>
                  <div className="exam-detail"><span>📊</span> {exam.totalMarks} marks</div>
                  <div className="exam-detail"><span>📝</span> {exam.examType === 'mcq' ? 'MCQ' : 'Practical'}</div>
                  <div className="exam-detail"><span>🎓</span> {exam.course} Sem {exam.semester}</div>
                </div>
                <div className="exam-card-actions">
                  <button className="btn-icon btn-edit" onClick={() => openModal('exam', exam)}>✏️</button>
                  <button className="btn-icon btn-delete" onClick={() => setDeleteConfirm({ type: 'exam', id: exam._id, name: exam.subjectName })}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderTimetable = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>Exam Timetable</h2>
          <p>Drag & drop to reschedule. View all exams in calendar format.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setActivePage('exams')}>← Back to List</button>
      </div>
      {exams.length === 0 ? (
        <div className="loading">No exams to display</div>
      ) : (
        <ExamCalendar
          exams={exams}
          onReschedule={async (examId, newDate) => {
            try {
              await API.put(`/admin/exams/${examId}`, { date: newDate });
              toast.success('Exam rescheduled!');
              fetchExams();
            } catch (err) {
              toast.error(err.response?.data?.message || 'Failed to reschedule');
            }
          }}
        />
      )}
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case 'subjects': return renderSubjects();
      case 'exams': return renderExams();
      case 'timetable': return renderTimetable();
      case 'dashboard':
      default: return renderDashboard();
    }
  };

  return (
    <div className="dashboard-page dashboard-layout">
      <Sidebar role="admin" activePage={activePage} onNavigate={setActivePage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <nav className="dashboard-nav">
          <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
          <div className="nav-brand"><span className="admin-badge">ADMIN PANEL</span></div>
          <div className="nav-welcome">Welcome, {user?.name}</div>
        </nav>
        <div className="dashboard-content">{renderPage()}</div>
      </div>

      {/* Modals */}
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
                {modalType === 'subject' && (
                  <>
                    <div className="form-row">
                      <div className="form-group"><label>Subject Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="Advanced Web Technologies" /></div>
                      <div className="form-group"><label>Subject Code</label><input type="text" name="code" value={formData.code || ''} onChange={handleInputChange} required placeholder="MCA401" disabled={!!editingItem} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Program</label><select name="course" value={formData.course || ''} onChange={handleInputChange} required>{courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}</select></div>
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || '1'} onChange={handleInputChange} required>{getSemesterOptions(formData.course).map(s => <option key={s} value={s}>Sem {s}</option>)}</select></div>
                    </div>
                    <div className="form-group"><label>Description</label><input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Optional" /></div>
                  </>
                )}
                {modalType === 'exam' && (
                  <>
                    <div className="form-group"><label>Subject</label><select name="subjectId" value={formData.subjectId || ''} onChange={handleInputChange} required>{subjects.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}</select></div>
                    <div className="form-row">
                      <div className="form-group"><label>Date</label><input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} required /></div>
                      <div className="form-group"><label>Time</label><input type="time" name="time" value={formData.time || ''} onChange={handleInputChange} required /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Duration (minutes)</label><input type="number" name="duration" value={formData.duration || 60} onChange={handleInputChange} required min={15} max={300} /></div>
                      <div className="form-group"><label>Total Marks</label><input type="number" name="totalMarks" value={formData.totalMarks || 100} onChange={handleInputChange} required min={10} max={500} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Exam Type</label><select name="examType" value={formData.examType || 'mcq'} onChange={handleInputChange} required><option value="mcq">MCQ</option><option value="practical">Practical</option></select></div>
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || ''} onChange={handleInputChange} required><option value="">Select Semester</option>{[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}</select></div>
                    </div>
                    <div className="form-group"><label>Program</label><select name="course" value={formData.course || ''} onChange={handleInputChange} required><option value="">Select Program</option>{courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}</select></div>
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

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Confirm Delete</h3><button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button></div>
            <div className="modal-body"><p className="delete-msg">Delete <strong>{deleteConfirm.name}</strong>?</p><p className="delete-warning">Cannot be undone.</p></div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;