/**
 * Admin Dashboard Component - Main admin panel with full CRUD operations
 * 
 * WHAT THIS PAGE DOES:
 * ====================
 * This is the admin panel that only admin users can see.
 * Admin users have enrollment numbers starting with "ADMIN" (e.g., ADMIN001).
 * 
 * ADMIN FEATURES (4 main sections):
 * ==================================
 * 1. DASHBOARD (default) → Admin profile card + stats overview
 * 2. STUDENTS → Full CRUD: Create, Read, Update, Delete student accounts
 * 3. SUBJECTS → Full CRUD: Create, Read, Update, Delete subjects (semester-wise)
 * 4. EXAMS → Schedule and manage exams with date, time, subject, semester, course
 *    - Admin selects a subject, sets date/time/duration/semester/course
 *    - Exam automatically appears for matching students
 * 
 * HOW EXAM SCHEDULING WORKS:
 * ==========================
 * 1. Admin clicks "Exams" in sidebar → sees exam list
 * 2. Clicks "Schedule Exam" → modal opens with form
 * 3. Admin selects subject from dropdown (subjects fetched from backend)
 * 4. Admin enters: date, time, duration, semester, course
 * 5. Exam is saved to database
 * 6. Students with matching semester+course see the exam in "My Exams"
 * 
 * HOW STATE MANAGEMENT WORKS:
 * ===========================
 * - activePage: Controls which section is visible
 * - users[], subjects[], exams[]: Data arrays from backend
 * - showModal: Controls add/edit modal visibility
 * - editingItem: null = Add mode, object = Edit mode
 * - modalType: 'student', 'subject', or 'exam'
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import ExamCalendar from '../components/ExamCalendar';
import API from '../api/axios';

// Convert a datetime-local input value (admin's local time) to an absolute UTC ISO
// timestamp. Without this, the stored value has no timezone and gets misread on
// servers running in a different timezone (e.g. Render runs in UTC).
const toIsoDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? val : d.toISOString();
};

// Convert a stored result date back to the local datetime-local format for the edit form.
const toLocalInputDate = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val).slice(0, 16);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const AdminDashboard = () => {
  const { user } = useAuth();

  // ========== NAVIGATION STATE ==========
  const [activePage, setActivePage] = useState('dashboard');

  // ========== STUDENT MANAGEMENT STATE ==========
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // ========== SUBJECT MANAGEMENT STATE ==========
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectError, setSubjectError] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');

  // ========== COURSES STATE ==========
  const [courses, setCourses] = useState([]);

  const getSemesterOptions = (courseCode) => {
    const course = courses.find(c => c.code === courseCode);
    const total = course?.totalSemesters || 4;
    return Array.from({ length: total }, (_, i) => i + 1);
  };

  // ========== EXAM MANAGEMENT STATE ==========
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examError, setExamError] = useState('');
  const [examSemesterFilter, setExamSemesterFilter] = useState('');

  // ========== MODAL STATE (shared for all types) ==========
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');  // 'student', 'subject', or 'exam'
  const [editingItem, setEditingItem] = useState(null);

  // ========== FORM STATE ==========
  const [formData, setFormData] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // ========== MOBILE SIDEBAR STATE ==========
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ========== DELETE CONFIRMATION STATE ==========
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ========== QUESTION MANAGEMENT STATE ==========
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [managingExam, setManagingExam] = useState(null); // exam being managed
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionForm, setQuestionForm] = useState({ questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1, modelAnswer: '', testCases: [] });
  const [questionLoading, setQuestionLoading] = useState(false);

  // ========== BULK UPLOAD STATE ==========
  const [bulkUploadText, setBulkUploadText] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // ========== RESULT DATE STATE ==========
  const [resultDateValue, setResultDateValue] = useState('');
  const [settingResultDate, setSettingResultDate] = useState(false);

  // ========== STUDENT BLOCK / BULK UPLOAD STATE ==========
  const [blockingUserId, setBlockingUserId] = useState(null);
  const [showStudentBulkModal, setShowStudentBulkModal] = useState(false);
  const [studentBulkText, setStudentBulkText] = useState('');
  const [studentBulkUploading, setStudentBulkUploading] = useState(false);

  // ========== SUBMISSIONS VIEW STATE ==========
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [submissionsExam, setSubmissionsExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState(null);

  // Code execution state for admin submissions view
  const [adminRunningCode, setAdminRunningCode] = useState(null);
  const [adminCodeOutput, setAdminCodeOutput] = useState({});
  const [adminCodeLang, setAdminCodeLang] = useState({});

  // ========== STUDENT CRUD ==========
  const fetchUsers = async () => {
    setLoadingUsers(true);
    setUserError('');
    try {
      const { data } = await API.get('/admin/users');
      setUsers(data.users);
    } catch (error) {
      setUserError(error.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      if (editingItem) {
        await API.put(`/admin/users/${editingItem._id}`, formData);
        toast.success('Student updated successfully!');
      } else {
        await API.post('/admin/users', formData);
        toast.success('Student added successfully!');
      }
      closeModal();
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteStudent = async (id) => {
    try {
      await API.delete(`/admin/users/${id}`);
      toast.success('Student deleted successfully!');
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete user';
      setUserError(msg);
      toast.error(msg);
    }
  };

  // Toggle block/unblock for a student account
  const handleToggleBlockStudent = async (student) => {
    setBlockingUserId(student._id);
    try {
      const { data } = await API.put(`/admin/users/${student._id}/block`, {});
      toast.success(data.message || 'Status updated');
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to update block status';
      toast.error(msg);
    } finally {
      setBlockingUserId(null);
    }
  };

  // ========== STUDENT BULK UPLOAD ==========
  const handleStudentBulkUpload = async () => {
    if (!studentBulkText.trim()) {
      toast.warning('Please paste your students data or upload a CSV/JSON file first');
      return;
    }
    setStudentBulkUploading(true);
    try {
      // Try parsing as JSON first
      let payload;
      try {
        const jsonData = JSON.parse(studentBulkText);
        payload = { users: Array.isArray(jsonData) ? jsonData : [jsonData] };
      } catch {
        // Not JSON — treat as CSV
        payload = { csvText: studentBulkText };
      }

      const { data } = await API.post('/admin/users/bulk', payload);
      toast.success(data.message || 'Students uploaded!');
      setStudentBulkText('');
      setShowStudentBulkModal(false);
      fetchUsers();
    } catch (error) {
      const msg = error.response?.data?.message || 'Bulk upload failed';
      toast.error(msg);
    } finally {
      setStudentBulkUploading(false);
    }
  };

  // ========== SUBJECT CRUD ==========
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    setSubjectError('');
    try {
      const { data } = await API.get('/admin/subjects');
      setSubjects(data.subjects);
    } catch (error) {
      setSubjectError(error.response?.data?.message || 'Failed to fetch subjects');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await API.get('/superadmin/courses/public');
      setCourses(data.courses || []);
    } catch {}
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      if (editingItem) {
        await API.put(`/admin/subjects/${editingItem._id}`, formData);
        toast.success('Subject updated successfully!');
      } else {
        await API.post('/admin/subjects', formData);
        toast.success('Subject added successfully!');
      }
      closeModal();
      fetchSubjects();
    } catch (error) {
      const msg = error.response?.data?.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSubject = async (id) => {
    try {
      await API.delete(`/admin/subjects/${id}`);
      toast.success('Subject deleted successfully!');
      setDeleteConfirm(null);
      fetchSubjects();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete subject';
      setSubjectError(msg);
      toast.error(msg);
    }
  };

  // ========== EXAM CRUD ==========
  /**
   * Fetch all exams from backend
   * API: GET /api/admin/exams
   */
  const fetchExams = async () => {
    setLoadingExams(true);
    setExamError('');
    try {
      const { data } = await API.get('/admin/exams');
      setExams(data.exams);
    } catch (error) {
      setExamError(error.response?.data?.message || 'Failed to fetch exams');
    } finally {
      setLoadingExams(false);
    }
  };

  /**
   * Create or Update an exam
   * API: POST /api/admin/exams or PUT /api/admin/exams/:id
   */
  const handleExamSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      const payload = { ...formData, resultDate: toIsoDate(formData.resultDate) };
      if (editingItem) {
        await API.put(`/admin/exams/${editingItem._id}`, payload);
        toast.success('Exam updated successfully!');
      } else {
        await API.post('/admin/exams', payload);
        toast.success('Exam scheduled successfully!');
      }
      closeModal();
      fetchExams();
    } catch (error) {
      const msg = error.response?.data?.message || 'Operation failed';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteExam = async (id) => {
    try {
      await API.delete(`/admin/exams/${id}`);
      toast.success('Exam deleted successfully!');
      setDeleteConfirm(null);
      fetchExams();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to delete exam';
      setExamError(msg);
      toast.error(msg);
    }
  };

  // ========== MODAL HELPERS ==========
  const openAddModal = (type) => {
    setModalType(type);
    setEditingItem(null);
    const defaultCourse = courses.length > 0 ? courses[0].code : '';
    if (type === 'student') {
      setFormData({ name: '', enrollmentNumber: '', email: '', phone: '', course: defaultCourse, semester: '1', aadharNumber: '', password: '' });
    } else if (type === 'subject') {
      setFormData({ name: '', code: '', semester: '1', course: defaultCourse, description: '' });
    } else if (type === 'exam') {
      const firstSubject = subjects.length > 0 ? subjects[0] : null;
      setFormData({ subjectId: '', date: '', time: '', duration: '60', semester: firstSubject ? String(firstSubject.semester) : '1', course: firstSubject ? firstSubject.course : defaultCourse, totalMarks: '100', totalQuestions: '0', examType: 'mcq', questionsPerStudent: '0', resultDate: '', evaluationMethod: 'manual', evaluationStrictness: 'medium' });
    }
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (type, item) => {
    setModalType(type);
    setEditingItem(item);
    const defaultCourse = courses.length > 0 ? courses[0].code : '';
    if (type === 'student') {
      setFormData({ name: item.name || '', email: item.email || '', phone: item.phone || '', course: item.course || defaultCourse, semester: item.semester || '1', password: '' });
    } else if (type === 'subject') {
      setFormData({ name: item.name || '', code: item.code || '', semester: item.semester || '1', course: item.course || defaultCourse, description: item.description || '' });
    } else if (type === 'exam') {
      setFormData({
        subjectId: item.subjectId?._id || item.subjectId || '',
        date: item.date || '',
        time: item.time || '',
        duration: item.duration || '60',
        semester: item.semester || '1',
        course: item.course || defaultCourse,
        totalMarks: item.totalMarks || '100',
        totalQuestions: item.totalQuestions || '0',
        examType: item.examType || 'mcq',
        questionsPerStudent: item.questionsPerStudent || '0',
        resultDate: toLocalInputDate(item.resultDate),
        evaluationMethod: item.evaluationMethod || 'manual',
        evaluationStrictness: item.evaluationStrictness || 'medium'
      });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
    setFormError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'course') {
      const total = courses.find(c => c.code === value)?.totalSemesters || 4;
      setFormData(prev => ({
        ...prev,
        course: value,
        semester: Number(prev.semester) > total ? '1' : prev.semester
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // ========== QUESTION MANAGEMENT ==========
  const openQuestionManager = async (exam) => {
    setManagingExam(exam);
    setShowQuestionModal(true);
    await fetchQuestions(exam._id);
  };

  const closeQuestionManager = () => {
    setShowQuestionModal(false);
    setManagingExam(null);
    setQuestions([]);
    setQuestionForm({ questionText: '', questionType: 'mcq', options: ['', '', '', ''], correctAnswer: '', marks: 1, modelAnswer: '', testCases: [] });
  };

  const fetchQuestions = async (examId) => {
    setLoadingQuestions(true);
    try {
      const { data } = await API.get(`/admin/exams/${examId}/questions`);
      setQuestions(data.questions);
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setQuestionLoading(true);
    try {
      await API.post(`/admin/exams/${managingExam._id}/questions`, questionForm);
      toast.success('Question added successfully!');
      setQuestionForm({ questionText: '', questionType: questionForm.questionType, options: ['', '', '', ''], correctAnswer: '', marks: 1, modelAnswer: '', testCases: [] });
      await fetchQuestions(managingExam._id);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add question');
    } finally {
      setQuestionLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      await API.delete(`/admin/exams/${managingExam._id}/questions/${questionId}`);
      toast.success('Question deleted!');
      await fetchQuestions(managingExam._id);
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const handleQuestionFormChange = (e) => {
    setQuestionForm({ ...questionForm, [e.target.name]: e.target.value });
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index] = value;
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  // ========== BULK UPLOAD ==========
  const handleBulkUpload = async () => {
    if (!bulkUploadText.trim()) {
      toast.warning('Please paste your questions data or upload a CSV file first');
      return;
    }
    setBulkUploading(true);
    try {
      // Try parsing as JSON first
      let payload;
      try {
        const jsonData = JSON.parse(bulkUploadText);
        if (Array.isArray(jsonData)) {
          payload = { questions: jsonData };
        } else {
          payload = { questions: [jsonData] };
        }
      } catch {
        // Not JSON — treat as CSV
        payload = { csvText: bulkUploadText };
      }

      const { data } = await API.post(`/admin/exams/${managingExam._id}/questions/bulk`, payload);
      toast.success(`${data.count} questions uploaded successfully!`);
      setBulkUploadText('');
      setShowBulkUpload(false);
      await fetchQuestions(managingExam._id);
    } catch (error) {
      const msg = error.response?.data?.message || 'Bulk upload failed';
      toast.error(msg);
    } finally {
      setBulkUploading(false);
    }
  };

  // ========== RESULT DATE ==========
  const handleSetResultDate = async (examId) => {
    setSettingResultDate(true);
    try {
      await API.put(`/admin/exams/${examId}/result-date`, { resultDate: resultDateValue ? toIsoDate(resultDateValue) : null });
      toast.success('Result date updated!');
      fetchExams();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update result date');
    } finally {
      setSettingResultDate(false);
    }
  };

  // ========== SUBMISSIONS VIEW ==========
  const openSubmissionsModal = async (exam) => {
    setSubmissionsExam(exam);
    setShowSubmissionsModal(true);
    setExpandedStudent(null);
    setLoadingSubmissions(true);
    try {
      const { data } = await API.get(`/admin/exams/${exam._id}/submissions`);
      setSubmissions(data.submissions || []);
    } catch (error) {
      toast.error('Failed to load submissions');
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const closeSubmissionsModal = () => {
    setShowSubmissionsModal(false);
    setSubmissionsExam(null);
    setSubmissions([]);
    setExpandedStudent(null);
    setAdminCodeOutput({});
  };

  const runCodeAdmin = async (subId, answer) => {
    const lang = adminCodeLang[subId] || 'python';
    if (!answer || !answer.trim()) {
      setAdminCodeOutput(prev => ({
        ...prev,
        [subId]: { running: false, output: '(No code to run — student did not submit code for this question)', isError: true }
      }));
      return;
    }
    setAdminRunningCode(subId);
    setAdminCodeOutput(prev => ({ ...prev, [subId]: { running: true } }));
    try {
      const { data } = await API.post('/exams/run-code', { code: answer, language: lang });

      if (data.status === 'preview' && data.previewHTML) {
        setAdminCodeOutput(prev => ({
          ...prev,
          [subId]: { running: false, isPreview: true, previewHTML: data.previewHTML, language: data.language }
        }));
        return;
      }

      const output = data.stdout || data.stderr || data.compile_output || '';
      const hasError = data.status === 'error' || data.stderr || data.compile_output;
      setAdminCodeOutput(prev => ({
        ...prev,
        [subId]: { running: false, output: output.trim() || '(No output)', isError: !!hasError, language: data.language }
      }));
    } catch (err) {
      const errMsg = err.response?.status === 400
        ? (err.response?.data?.message || 'Invalid request — code or language missing')
        : (err.response?.data?.message || 'Code execution failed — check your network');
      setAdminCodeOutput(prev => ({
        ...prev,
        [subId]: { running: false, output: errMsg, isError: true }
      }));
    } finally {
      setAdminRunningCode(null);
    }
  };

  // ========== DATA LOADING ==========
  useEffect(() => {
    fetchCourses();
    if (activePage === 'students') fetchUsers();
    if (activePage === 'subjects') fetchSubjects();
    if (activePage === 'exams') {
      fetchExams();
      fetchSubjects(); // Need subjects for the dropdown
    }
  }, [activePage]);

  // ========== FILTERED DATA ==========
  const filteredUsers = users.filter(
    (u) =>
      (u.role === 'user') && (
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.enrollmentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.course?.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const filteredSubjects = semesterFilter
    ? subjects.filter((s) => s.semester === Number(semesterFilter))
    : subjects;

  const filteredExams = examSemesterFilter
    ? exams.filter((e) => e.semester === Number(examSemesterFilter))
    : exams;

  const totalStudents = users.filter((u) => u.role === 'user').length;
  const totalSubjects = subjects.length;
  const totalExams = exams.length;

  // Helper: determine exam status (upcoming vs ongoing vs completed)
  const getExamStatus = (exam) => {
    const examStart = new Date(`${exam.date}T${exam.time}`);
    const examEnd = new Date(examStart.getTime() + exam.duration * 60000);
    const now = new Date();
    if (now < examStart) return 'upcoming';
    if (now <= examEnd) return 'ongoing';
    return 'completed';
  };

  // ========== RENDER SECTIONS ==========
  const renderPage = () => {
    switch (activePage) {
      // ==========================================
      // STUDENTS SECTION
      // ==========================================
      case 'students':
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>Manage Students</h2>
                <p>Create, update, and remove student accounts</p>
              </div>
              <div className="section-header-actions">
                {/* Bulk register students from a CSV or JSON file */}
                <button className="btn btn-secondary" onClick={() => setShowStudentBulkModal(true)}>📦 Bulk Upload</button>
                <button className="btn btn-primary" onClick={() => openAddModal('student')}>+ Add Student</button>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-card stat-blue"><span className="stat-number">{totalStudents}</span><span className="stat-label">Students</span></div>
              <div className="stat-card stat-green"><span className="stat-number">{totalSubjects}</span><span className="stat-label">Subjects</span></div>
              <div className="stat-card stat-purple"><span className="stat-number">{totalExams}</span><span className="stat-label">Exams</span></div>
            </div>
            <div className="search-bar">
              <input type="text" placeholder="Search by name, enrollment, email, or program..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            </div>
            {loadingUsers ? <div className="loading">Loading students...</div> : userError ? <div className="error-msg">{userError}</div> : (
              <div className="table-container">
                <table className="users-table">
                  <thead><tr><th>#</th><th>Name</th><th>Enrollment</th><th>Email</th><th>Phone</th><th>Program</th><th>Sem</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredUsers.length === 0 ? <tr><td colSpan="8" className="no-data">{searchTerm ? 'No students match' : 'No students yet'}</td></tr> :
                      filteredUsers.map((u, i) => (
                        <tr key={u._id}>
                          <td data-label="#">{i + 1}</td><td data-label="Name" className="name-cell">{u.name}{u.isBlocked && <span className="status-blocked-badge">Blocked</span>}</td><td data-label="Enrollment" className="enrollment-cell">{u.enrollmentNumber}</td>
                          <td data-label="Email">{u.email}</td><td data-label="Phone">{u.phone}</td><td data-label="Program">{u.course}</td><td data-label="Sem">{u.semester}</td>
                          <td data-label="Actions" className="actions-cell">
                            <button className="btn-icon btn-edit" onClick={() => openEditModal('student', u)}>✏️</button>
                            {/* Block/unblock the student's account (blocked users can't log in) */}
                            <button
                              className={`btn-icon ${u.isBlocked ? 'btn-unblock' : 'btn-block'}`}
                              title={u.isBlocked ? 'Unblock student' : 'Block student'}
                              disabled={blockingUserId === u._id}
                              onClick={() => handleToggleBlockStudent(u)}
                            >
                              {blockingUserId === u._id ? '⏳' : (u.isBlocked ? '✅' : '🚫')}
                            </button>
                            <button className="btn-icon btn-delete" onClick={() => setDeleteConfirm({ type: 'student', id: u._id, name: u.name })}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      // ==========================================
      // SUBJECTS SECTION (Read-only for admin)
      // ==========================================
      case 'subjects':
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>My Subjects</h2>
                <p>Subjects assigned to you by Super Admin</p>
              </div>
            </div>

            {loadingSubjects ? <div className="loading">Loading subjects...</div> : subjectError ? <div className="error-msg">{subjectError}</div> : subjects.length === 0 ? (
              <div className="coming-soon" style={{ padding: '48px 40px', textAlign: 'center' }}>
                <span className="coming-icon" style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📋</span>
                <h3 style={{ color: '#176B3A', marginBottom: '8px' }}>No Subjects Assigned Yet</h3>
                <p style={{ color: '#667085', fontSize: '15px', maxWidth: '420px', margin: '0 auto', lineHeight: '1.6' }}>
                  The Super Admin will soon assign you as a faculty for specific subjects. Once assigned, you will be able to create exams, manage questions, and view submissions for those subjects.
                </p>
              </div>
            ) : (
              <>
                <div className="filter-row">
                  <span className="filter-label">Filter by Semester:</span>
                  <button className={`filter-btn ${semesterFilter === '' ? 'active' : ''}`} onClick={() => setSemesterFilter('')}>All</button>
                  {[1, 2, 3, 4].map((sem) => (
                    <button key={sem} className={`filter-btn ${semesterFilter === String(sem) ? 'active' : ''}`} onClick={() => setSemesterFilter(String(sem))}>Sem {sem}</button>
                  ))}
                </div>
                <div className="table-container">
                  <table className="users-table subject-table">
                    <thead><tr><th>#</th><th>Subject Name</th><th>Code</th><th>Semester</th><th>Program</th><th>Description</th></tr></thead>
                    <tbody>
                      {filteredSubjects.length === 0 ? (
                        <tr><td colSpan="6" className="no-data">No subjects found for Semester {semesterFilter}</td></tr>
                      ) :
                        filteredSubjects.map((s, i) => (
                          <tr key={s._id}>
                            <td>{i + 1}</td><td className="name-cell">{s.name}</td><td className="enrollment-cell">{s.code}</td>
                            <td><span className="semester-tag">Sem {s.semester}</span></td><td>{s.course}</td>
                            <td className="desc-cell">{s.description || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );

      // ==========================================
      // TIMETABLE - Interactive Calendar View
      // ==========================================
      case 'timetable':
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>Exam Timetable</h2>
                <p>Drag & drop exams to reschedule. View all exams in calendar format.</p>
              </div>
              <button className="btn btn-secondary" onClick={() => setActivePage('exams')}>← Back to List</button>
            </div>
            {exams.length === 0 ? (
              <div className="loading">Loading exams...</div>
            ) : (
              <ExamCalendar
                exams={exams}
                onReschedule={async (examId, newDate, currentTime) => {
                  try {
                    await API.put(`/admin/exams/${examId}`, { date: newDate });
                    toast.success('Exam rescheduled successfully!');
                    fetchExams();
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to reschedule');
                  }
                }}
              />
            )}
          </div>
        );

      // ==========================================
      // EXAMS SECTION - Schedule and manage exams
      // ==========================================
      case 'exams':
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>Schedule Exams</h2>
                <p>Create, update, and manage exam schedules</p>
              </div>
              <button className="btn btn-primary" onClick={() => openAddModal('exam')}>+ Schedule Exam</button>
            </div>

            {/* Stats row for exams */}
            <div className="stats-row">
              <div className="stat-card stat-blue">
                <span className="stat-number">{exams.length}</span>
                <span className="stat-label">Total Exams</span>
              </div>
              <div className="stat-card stat-green">
                <span className="stat-number">{exams.filter((e) => getExamStatus(e) === 'upcoming').length}</span>
                <span className="stat-label">Upcoming</span>
              </div>
              <div className="stat-card stat-purple">
                <span className="stat-number">{exams.filter((e) => getExamStatus(e) === 'ongoing').length}</span>
                <span className="stat-label">Live</span>
              </div>
              <div className="stat-card stat-orange">
                <span className="stat-number">{exams.filter((e) => getExamStatus(e) === 'completed').length}</span>
                <span className="stat-label">Completed</span>
              </div>
            </div>

            {/* Semester filter */}
            <div className="filter-row">
              <span className="filter-label">Filter by Semester:</span>
              <button className={`filter-btn ${examSemesterFilter === '' ? 'active' : ''}`} onClick={() => setExamSemesterFilter('')}>All</button>
              {[1, 2, 3, 4].map((sem) => (
                <button key={sem} className={`filter-btn ${examSemesterFilter === String(sem) ? 'active' : ''}`} onClick={() => setExamSemesterFilter(String(sem))}>Sem {sem}</button>
              ))}
            </div>

            {loadingExams ? <div className="loading">Loading exams...</div> : examError ? <div className="error-msg">{examError}</div> : (
              <div className="table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Subject</th><th>Code</th><th>Type</th><th>Date</th><th>Time</th><th>Duration</th><th>Sem</th><th>Program</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.length === 0 ? (
                      <tr><td colSpan="11" className="no-data">No exams scheduled yet</td></tr>
                    ) : (
                      filteredExams.map((ex, i) => {
                        const status = getExamStatus(ex);
                        return (
                          <tr key={ex._id}>
                            <td data-label="#">{i + 1}</td>
                            <td data-label="Subject" className="name-cell">{ex.subjectName}</td>
                            <td data-label="Code" className="enrollment-cell">{ex.subjectCode}</td>
                            <td data-label="Type"><span className={`exam-type-tag ${ex.examType === 'mcq' ? 'type-mcq' : 'type-practical'}`}>{ex.examType === 'mcq' ? 'MCQ' : 'Practical'}</span></td>
                            <td data-label="Date">{ex.date}</td>
                            <td data-label="Time">{ex.time}</td>
                            <td data-label="Duration">{ex.duration} min</td>
                            <td data-label="Sem"><span className="semester-tag">Sem {ex.semester}</span></td>
                            <td data-label="Program">{ex.course}</td>
                            <td data-label="Status">
                              <span className={`exam-status ${status === 'upcoming' ? 'status-upcoming' : status === 'ongoing' ? 'status-ongoing' : 'status-completed'}`}>
                                {status === 'upcoming' ? 'Upcoming' : status === 'ongoing' ? 'LIVE' : 'Completed'}
                              </span>
                            </td>
                            <td data-label="Actions" className="actions-cell">
                              <button className="btn-icon btn-edit" title="View Submissions" onClick={() => openSubmissionsModal(ex)}>📋</button>
                              <button className="btn-icon btn-edit" title="Manage Questions" onClick={() => openQuestionManager(ex)}>❓</button>
                              <button className="btn-icon btn-edit" title="Set Result Date" onClick={() => { setResultDateValue(toLocalInputDate(ex.resultDate)); setDeleteConfirm({ type: 'resultDate', id: ex._id, name: ex.subjectName }); }}>📅</button>
                              <button className="btn-icon btn-notify" title="Send Email Reminder" onClick={async () => { try { const { data } = await API.post(`/notifications/send-reminder/${ex._id}`); toast.success(data.message); } catch (e) { const msg = e.response?.data?.message || 'Failed to send reminder'; toast.error(msg); } }}>📧</button>
                              <button className="btn-icon btn-notify" title="Notify Results" onClick={async () => { try { const { data } = await API.post(`/notifications/send-results/${ex._id}`); toast.success(data.message); } catch (e) { const msg = e.response?.data?.message || 'Failed to send results'; toast.error(msg); } }}>📊</button>
                              {ex.examType === 'practical' && (
                                <button className="btn-icon btn-edit" title="Check Plagiarism" onClick={async () => { try { const { data } = await API.get(`/admin/exams/${ex._id}/plagiarism`); const flagged = data.pairs?.filter(p => p.flagged)?.length || 0; toast.info(`Plagiarism check complete: ${flagged} flagged pairs out of ${data.summary?.comparisons || 0} comparisons`); } catch (e) { toast.error('Failed to check plagiarism'); } }}>🔍</button>
                              )}
                              <button className="btn-icon btn-edit" onClick={() => openEditModal('exam', ex)}>✏️</button>
                              <button className="btn-icon btn-delete" onClick={() => setDeleteConfirm({ type: 'exam', id: ex._id, name: ex.subjectName })}>🗑️</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      // ==========================================
      // DASHBOARD - Default overview
      // ==========================================
      default:
        return (
          <>
            <div className="welcome-section admin-welcome">
              <h1>Welcome, Admin {user?.name}!</h1>
              <p>Enrollment: {user?.enrollmentNumber} | Role: {user?.role?.toUpperCase()}</p>
            </div>
            <div className="stats-row">
              <div className="stat-card stat-blue"><span className="stat-number">{totalStudents}</span><span className="stat-label">Students</span></div>
              <div className="stat-card stat-green"><span className="stat-number">{totalSubjects}</span><span className="stat-label">Subjects</span></div>
              <div className="stat-card stat-purple"><span className="stat-number">{totalExams}</span><span className="stat-label">Exams</span></div>
            </div>
            <div className="student-info">
              <h2>Admin Profile</h2>
              <div className="info-grid">
                <div className="info-item"><label>Name</label><span>{user?.name}</span></div>
                <div className="info-item"><label>Enrollment No</label><span>{user?.enrollmentNumber}</span></div>
                <div className="info-item"><label>Email</label><span>{user?.email}</span></div>
                <div className="info-item"><label>Phone</label><span>{user?.phone}</span></div>
                <div className="info-item"><label>Role</label><span className="role-badge">{user?.role?.toUpperCase()}</span></div>
                <div className="info-item"><label>Access Level</label><span>Full Access</span></div>
              </div>
            </div>
            <div className="subjects-section">
              <h2>Quick Actions</h2>
              <div className="subjects-grid">
                <div className="subject-card admin-card clickable" onClick={() => setActivePage('students')}>
                  <div className="subject-icon">👥</div><h3>Manage Students</h3><p>Add, edit, or remove student accounts</p>
                </div>
                <div className="subject-card admin-card clickable" onClick={() => setActivePage('subjects')}>
                  <div className="subject-icon">📚</div><h3>My Subjects</h3><p>View subjects assigned to you by Super Admin</p>
                </div>
                <div className="subject-card admin-card clickable" onClick={() => setActivePage('exams')}>
                  <div className="subject-icon">📝</div><h3>Schedule Exams</h3><p>Set exam date, time, and subject details</p>
                </div>
                <div className="subject-card admin-card clickable" onClick={() => { setActivePage('timetable'); fetchExams(); }}>
                  <div className="subject-icon">📅</div><h3>Exam Timetable</h3><p>Interactive calendar with drag & drop rescheduling</p>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  // ========== MAIN RETURN ==========
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

      {/* ========== ADD/EDIT MODAL ========== */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? `Edit ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}` : `Schedule New ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={modalType === 'student' ? handleStudentSubmit : modalType === 'subject' ? handleSubjectSubmit : handleExamSubmit}>
              <div className="modal-body">
                {formError && <div className="error-msg">{formError}</div>}

                {/* STUDENT FORM */}
                {modalType === 'student' && (
                  <>
                    {!editingItem && (
                      <div className="form-group"><label>Enrollment Number</label><input type="text" name="enrollmentNumber" value={formData.enrollmentNumber || ''} onChange={handleInputChange} placeholder="e.g., 2504070200049" required /></div>
                    )}
                    <div className="form-group"><label>Full Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="Enter student name" required /></div>
                    <div className="form-group"><label>Email</label><input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} placeholder="student@email.com" required /></div>
                    <div className="form-group"><label>Phone</label><input type="text" name="phone" value={formData.phone || ''} onChange={handleInputChange} placeholder="10-digit phone" required /></div>
                    <div className="form-row">
                      <div className="form-group"><label>Program</label><select name="course" value={formData.course || ''} onChange={handleInputChange} required>{courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}</select></div>
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || '1'} onChange={handleInputChange}>{getSemesterOptions(formData.course).map(s => <option key={s} value={s}>Semester {s}</option>)}</select></div>
                    </div>
                    {!editingItem && (
                      <>
                        <div className="form-group"><label>Aadhar Number (12 digits)</label><input type="text" name="aadharNumber" value={formData.aadharNumber || ''} onChange={handleInputChange} placeholder="12-digit Aadhar number" required /></div>
                        <div className="form-group"><label>Password (Aadhar Number)</label><input type="password" name="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Same as Aadhar" required /></div>
                      </>
                    )}
                    {editingItem && (
                      <div className="form-group"><label>New Password (leave blank to keep current)</label><input type="password" name="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Optional" /></div>
                    )}
                  </>
                )}

                {/* SUBJECT FORM */}
                {modalType === 'subject' && (
                  <>
                    <div className="form-group"><label>Subject Name</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} placeholder="e.g., Advanced Web Technologies" required /></div>
                    {!editingItem && (
                      <div className="form-group"><label>Subject Code</label><input type="text" name="code" value={formData.code || ''} onChange={handleInputChange} placeholder="e.g., MCA401" required /></div>
                    )}
                    <div className="form-row">
                      <div className="form-group"><label>Semester</label><select name="semester" value={formData.semester || '1'} onChange={handleInputChange}>{getSemesterOptions(formData.course).map(s => <option key={s} value={s}>Semester {s}</option>)}</select></div>
                      <div className="form-group"><label>Program</label><select name="course" value={formData.course || ''} onChange={handleInputChange} required>{courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}</select></div>
                    </div>
                    <div className="form-group"><label>Description (optional)</label><input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Brief description" /></div>
                  </>
                )}

                {/* EXAM FORM */}
                {modalType === 'exam' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Program</label>
                        <select name="course" value={formData.course || ''} onChange={handleInputChange} required>
                          {courses.map(c => <option key={c._id} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Semester</label>
                        <select name="semester" value={formData.semester || '1'} onChange={handleInputChange}>
                          {getSemesterOptions(formData.course).map(s => <option key={s} value={s}>Semester {s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Select Subject</label>
                      <select name="subjectId" value={formData.subjectId || ''} onChange={handleInputChange} required>
                        <option value="">-- Choose a subject --</option>
                        {subjects
                          .filter(s => s.semester === Number(formData.semester || '1') && s.course === (formData.course || 'MCA'))
                          .map((s) => (
                            <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                          ))}
                      </select>
                      {subjects.filter(s => s.semester === Number(formData.semester || '1') && s.course === (formData.course || 'MCA')).length === 0 && (
                            <span className="field-hint" style={{color:'#D64545'}}>No assigned subjects for this semester & program.</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Exam Type</label>
                      <select name="examType" value={formData.examType || 'mcq'} onChange={handleInputChange}>
                        <option value="mcq">MCQ (Multiple Choice Questions)</option>
                        <option value="practical">Practical (Text/Code Answers)</option>
                      </select>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Exam Date</label><input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} required /></div>
                      <div className="form-group"><label>Start Time</label><input type="time" name="time" value={formData.time || ''} onChange={handleInputChange} required /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Duration (minutes)</label><input type="number" name="duration" value={formData.duration || '60'} onChange={handleInputChange} min="15" max="300" required /></div>
                      <div className="form-group"><label>Total Marks</label><input type="number" name="totalMarks" value={formData.totalMarks || '100'} onChange={handleInputChange} min="1" required /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Questions Per Student (Practical only)</label>
                        <input type="number" name="questionsPerStudent" value={formData.questionsPerStudent || '0'} onChange={handleInputChange} min="0" placeholder="0 = all questions" />
                        <span className="field-hint">MCQ: all students get every question (shuffled). Practical: random subset from pool.</span>
                      </div>
                      <div className="form-group">
                        <label>Result Publish Date & Time</label>
                        <input type="datetime-local" name="resultDate" value={formData.resultDate || ''} onChange={handleInputChange} />
                        <span className="field-hint">Students see scores only after this date & time.</span>
                      </div>
                    </div>
                    {formData.examType === 'practical' && (
                      <div className="form-row">
                        <div className="form-group">
                          <label>Evaluation Method</label>
                          <select name="evaluationMethod" value={formData.evaluationMethod || 'manual'} onChange={handleInputChange}>
                            <option value="manual">Manual Checking</option>
                            <option value="ai">AI Checking</option>
                          </select>
                          <span className="field-hint">AI Checking uses GPT-4 to evaluate code correctness and quality automatically.</span>
                        </div>
                        {formData.evaluationMethod === 'ai' && (
                          <div className="form-group">
                            <label>Evaluation Strictness</label>
                            <select name="evaluationStrictness" value={formData.evaluationStrictness || 'medium'} onChange={handleInputChange}>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            <span className="field-hint">Controls how strictly the AI evaluates code quality, naming, and optimization.</span>
                          </div>
                        )}
                      </div>
                    )}
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
      {deleteConfirm && deleteConfirm.type !== 'resultDate' && (
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
              <button className="btn btn-danger" onClick={() => {
                if (deleteConfirm.type === 'student') handleDeleteStudent(deleteConfirm.id);
                else if (deleteConfirm.type === 'subject') handleDeleteSubject(deleteConfirm.id);
                else if (deleteConfirm.type === 'exam') handleDeleteExam(deleteConfirm.id);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== STUDENT BULK UPLOAD MODAL ========== */}
      {showStudentBulkModal && (
        <div className="modal-overlay" onClick={() => setShowStudentBulkModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Bulk Upload Students</h3>
              <button className="modal-close" onClick={() => setShowStudentBulkModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* File Upload */}
              <div style={{ marginBottom: '14px', padding: '14px', background: 'white', borderRadius: '8px', border: '1px solid #ffe0b2' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: '#555' }}>
                  📁 Upload CSV / JSON File
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,.json"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setStudentBulkText(ev.target.result);
                      toast.success(`Loaded ${file.name} (${ev.target.result.split(/\r?\n/).filter(l => l.trim()).length} lines)`);
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                  style={{ fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: '#999', marginTop: '4px', display: 'block' }}>
                  Select a .csv, .txt, or .json file — content will appear in the text area below
                </span>
              </div>

              {/* Format Guide */}
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'white', borderRadius: '8px', border: '1px solid #ffe0b2', fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                <strong style={{ color: '#D89B00' }}>CSV Format (header optional):</strong><br/>
                <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
                  name, enrollmentNumber, email, phone, course, semester, aadharNumber[, password]
                </code><br/>
                <span style={{ color: '#888' }}>
                  Example:<br/>
                  <code>"Het Patel","2504070200101","het@example.com","7383539000","MCA","3","123456789012"</code><br/>
                </span>
                <span style={{ color: '#888' }}>Password is optional — defaults to the Aadhar number. Duplicate enrollment/email rows are skipped and reported.</span>
              </div>

              {/* Or paste JSON */}
              <details style={{ marginBottom: '12px' }}>
                <summary style={{ fontSize: '12px', color: '#888', cursor: 'pointer', marginBottom: '6px' }}>
                  Or paste JSON array instead of CSV
                </summary>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px', lineHeight: '1.5' }}>
                  {'[{"name":"Het Patel","enrollmentNumber":"2504070200101","email":"het@example.com","phone":"7383539000","course":"MCA","semester":"3","aadharNumber":"123456789012"}]'}
                </div>
              </details>

              {/* Text Area */}
              <textarea
                value={studentBulkText}
                onChange={(e) => setStudentBulkText(e.target.value)}
                placeholder={'Paste CSV here or use file upload above...\n\nname,enrollmentNumber,email,phone,course,semester,aadharNumber\n"Het Patel","2504070200101","het@example.com","7383539000","MCA","3","123456789012"'}
                rows="10"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }}
              />

              {studentBulkText.trim() && (
                <p style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
                  {studentBulkText.split(/\r?\n/).filter(l => l.trim()).length} lines ready to upload
                </p>
              )}

              <button
                className="btn btn-primary"
                onClick={handleStudentBulkUpload}
                disabled={studentBulkUploading || !studentBulkText.trim()}
                style={{ marginTop: '10px' }}
              >
                {studentBulkUploading ? 'Uploading...' : 'Upload Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== RESULT DATE MODAL ========== */}
      {deleteConfirm && deleteConfirm.type === 'resultDate' && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Set Result Date — {deleteConfirm.name}</h3>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Result Publish Date & Time</label>
                <input type="datetime-local" value={resultDateValue} onChange={(e) => setResultDateValue(e.target.value)} />
                <span className="field-hint">Students will see their scores only after this date & time. Leave empty to hide results.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={settingResultDate} onClick={async () => {
                await handleSetResultDate(deleteConfirm.id);
                setDeleteConfirm(null);
              }}>{settingResultDate ? 'Saving...' : 'Save Date'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== QUESTION MANAGEMENT MODAL ========== */}
      {showQuestionModal && managingExam && (
        <div className="modal-overlay" onClick={closeQuestionManager}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Questions — {managingExam.subjectName} ({managingExam.examType === 'mcq' ? 'MCQ' : 'Practical'})</h3>
              <button className="modal-close" onClick={closeQuestionManager}>✕</button>
            </div>
            <div className="modal-body">
              {/* Bulk Upload Toggle */}
              <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
                <button className="btn btn-primary" onClick={() => setShowBulkUpload(!showBulkUpload)}>
                  {showBulkUpload ? '← Back to Single' : '📦 Bulk Upload Questions'}
                </button>
              </div>

              {/* Bulk Upload Section */}
              {showBulkUpload && (
                <div className="question-form-section" style={{background:'#FFF8E1',border:'2px solid #D89B00'}}>
                  <h4>Bulk Upload Questions ({managingExam.examType === 'mcq' ? 'MCQ' : 'Practical'})</h4>

                  {/* File Upload */}
                  <div style={{marginBottom:'14px',padding:'14px',background:'white',borderRadius:'8px',border:'1px solid #ffe0b2'}}>
                    <label style={{display:'block',fontWeight:600,fontSize:'13px',marginBottom:'6px',color:'#555'}}>
                      📁 Upload CSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setBulkUploadText(ev.target.result);
                          toast.success(`Loaded ${file.name} (${ev.target.result.split(/\r?\n/).filter(l=>l.trim()).length} lines)`);
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                      style={{fontSize:'13px'}}
                    />
                    <span style={{fontSize:'11px',color:'#999',marginTop:'4px',display:'block'}}>
                      Select a .csv or .txt file — content will appear in the text area below
                    </span>
                  </div>

                  {/* Format Guide */}
                  <div style={{marginBottom:'12px',padding:'10px 14px',background:'white',borderRadius:'8px',border:'1px solid #ffe0b2',fontSize:'12px',color:'#666',lineHeight:'1.6'}}>
                    <strong style={{color:'#D89B00'}}>CSV Format:</strong><br/>
                    {managingExam.examType === 'mcq' ? (
                      <>
                        <code style={{background:'#f5f5f5',padding:'2px 6px',borderRadius:'3px'}}>
                          questionText, optionA, optionB, optionC, optionD, correctAnswer, marks
                        </code><br/>
                        <span style={{color:'#888'}}>
                          Example:<br/>
                          <code>"What is HTML?","Language","Framework","Database","OS","Language",1</code><br/>
                          <code>"CSS stands for?","Cascading Style Sheets","Computer Style Sheets","Creative Style Sheets","Colorful Style Sheets","Cascading Style Sheets",1</code>
                        </span><br/>
                        <span style={{color:'#888'}}>Header row is optional. Commas inside quotes are handled. 4 options required for MCQ.</span>
                      </>
                    ) : (
                      <>
                        <code style={{background:'#f5f5f5',padding:'2px 6px',borderRadius:'3px'}}>
                          questionText, marks
                        </code><br/>
                        <span style={{color:'#888'}}>
                          Example:<br/>
                          <code>"Write a program to reverse a string",10</code><br/>
                          <code>"Explain recursion with example",10</code>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Or paste JSON */}
                  <details style={{marginBottom:'12px'}}>
                    <summary style={{fontSize:'12px',color:'#888',cursor:'pointer',marginBottom:'6px'}}>
                      Or paste JSON array instead of CSV
                    </summary>
                    <div style={{fontSize:'11px',color:'#888',marginBottom:'6px',lineHeight:'1.5'}}>
                      {managingExam.examType === 'mcq'
                        ? '[{"questionText":"Q?","options":["A","B","C","D"],"correctAnswer":"A","marks":1}]'
                        : '[{"questionText":"Q?","marks":10}]'
                      }
                    </div>
                  </details>

                  {/* Text Area */}
                  <textarea
                    value={bulkUploadText}
                    onChange={(e) => setBulkUploadText(e.target.value)}
                    placeholder={managingExam.examType === 'mcq'
                      ? 'Paste CSV here or use file upload above...\n\nquestionText,optionA,optionB,optionC,optionD,correctAnswer,marks\n"What is HTML?","Language","Framework","Database","OS","Language",1'
                      : 'Paste CSV here or use file upload above...\n\nquestionText,marks\n"Write a program to reverse a string",10'
                    }
                    rows="10"
                    style={{width:'100%',padding:'12px',borderRadius:'8px',border:'1px solid #ccc',fontFamily:'monospace',fontSize:'13px',resize:'vertical'}}
                  />

                  {bulkUploadText.trim() && (
                    <p style={{fontSize:'11px',color:'#888',marginTop:'6px'}}>
                      {bulkUploadText.split(/\r?\n/).filter(l => l.trim()).length} lines ready to upload
                    </p>
                  )}

                  <button className="btn btn-primary" onClick={handleBulkUpload} disabled={bulkUploading || !bulkUploadText.trim()} style={{marginTop:'10px'}}>
                    {bulkUploading ? 'Uploading...' : `Upload ${managingExam.examType === 'mcq' ? 'MCQ' : 'Practical'} Questions`}
                  </button>
                </div>
              )}

              {/* Add Question Form (single) */}
              {!showBulkUpload && (
              <div className="question-form-section">
                <h4>Add New Question</h4>
                <form onSubmit={handleQuestionSubmit}>
                  <div className="form-group">
                    <label>Question Text</label>
                    <textarea name="questionText" value={questionForm.questionText} onChange={handleQuestionFormChange} placeholder="Enter your question..." required rows="2" style={{width:'100%',padding:'10px',borderRadius:'8px',border:'1px solid #ddd',fontFamily:'inherit'}} />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Question Type</label>
                      <select name="questionType" value={questionForm.questionType} onChange={handleQuestionFormChange}>
                        <option value="mcq">MCQ</option>
                        <option value="practical">Practical</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Marks</label>
                      <input type="number" name="marks" value={questionForm.marks} onChange={handleQuestionFormChange} min="1" max="100" />
                    </div>
                  </div>

                  {questionForm.questionType === 'mcq' && (
                    <>
                      <div className="form-group">
                        <label>Options</label>
                        {questionForm.options.map((opt, idx) => (
                          <div key={idx} style={{display:'flex',gap:'8px',marginBottom:'6px',alignItems:'center'}}>
                            <span style={{fontWeight:600,minWidth:'24px'}}>{String.fromCharCode(65 + idx)}.</span>
                            <input type="text" value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + idx)}`} required style={{flex:1,padding:'8px',borderRadius:'6px',border:'1px solid #ddd'}} />
                          </div>
                        ))}
                      </div>
                      <div className="form-group">
                        <label>Correct Answer</label>
                        <select name="correctAnswer" value={questionForm.correctAnswer} onChange={handleQuestionFormChange} required>
                          <option value="">-- Select correct answer --</option>
                          {questionForm.options.filter(o => o.trim()).map((opt, idx) => (
                            <option key={idx} value={opt}>{String.fromCharCode(65 + idx)}. {opt}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {questionForm.questionType === 'practical' && (
                    <>
                      <div className="form-group">
                        <label>Model Answer (expected correct code)</label>
                        <textarea
                          name="modelAnswer"
                          value={questionForm.modelAnswer}
                          onChange={handleQuestionFormChange}
                          placeholder="Write the correct solution code here..."
                          rows="6"
                          style={{width:'100%',padding:'10px',borderRadius:'8px',border:'1px solid #ddd',fontFamily:'monospace',fontSize:'13px',resize:'vertical'}}
                        />
                        <span className="field-hint">Student code will be compared against this model answer for accurate grading.</span>
                      </div>
                      <div className="form-group">
                        <label>Test Cases ({questionForm.testCases.length})</label>
                        <span className="field-hint" style={{display:'block',marginBottom:'8px'}}>Define input/output pairs to validate code correctness.</span>
                        {questionForm.testCases.map((tc, tci) => (
                          <div key={tci} style={{display:'flex',gap:'8px',marginBottom:'6px',alignItems:'center'}}>
                            <input
                              type="text"
                              value={tc.input}
                              onChange={(e) => {
                                const newTCs = [...questionForm.testCases];
                                newTCs[tci] = { ...newTCs[tci], input: e.target.value };
                                setQuestionForm({ ...questionForm, testCases: newTCs });
                              }}
                              placeholder="Input"
                              style={{flex:1,padding:'8px',borderRadius:'6px',border:'1px solid #ddd',fontFamily:'monospace',fontSize:'12px'}}
                            />
                            <input
                              type="text"
                              value={tc.expectedOutput}
                              onChange={(e) => {
                                const newTCs = [...questionForm.testCases];
                                newTCs[tci] = { ...newTCs[tci], expectedOutput: e.target.value };
                                setQuestionForm({ ...questionForm, testCases: newTCs });
                              }}
                              placeholder="Expected output"
                              style={{flex:1,padding:'8px',borderRadius:'6px',border:'1px solid #ddd',fontFamily:'monospace',fontSize:'12px'}}
                            />
                            <button
                              type="button"
                              className="btn-icon btn-delete"
                              onClick={() => {
                                const newTCs = questionForm.testCases.filter((_, i) => i !== tci);
                                setQuestionForm({ ...questionForm, testCases: newTCs });
                              }}
                              style={{padding:'4px 8px',fontSize:'14px'}}
                            >✕</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setQuestionForm({
                              ...questionForm,
                              testCases: [...questionForm.testCases, { input: '', expectedOutput: '' }]
                            });
                          }}
                          style={{marginTop:'4px',fontSize:'12px',padding:'4px 12px'}}
                        >+ Add Test Case</button>
                      </div>
                    </>
                  )}

                  <button type="submit" className="btn btn-primary" disabled={questionLoading} style={{marginTop:'8px'}}>
                    {questionLoading ? 'Adding...' : '+ Add Question'}
                  </button>
                </form>
              </div>
              )}

              {/* Existing Questions List */}
              <div className="questions-list-section" style={{marginTop:'20px'}}>
                <h4>Questions ({questions.length})</h4>
                {loadingQuestions ? <p>Loading...</p> : questions.length === 0 ? (
                  <p style={{color:'#888',textAlign:'center',padding:'20px'}}>No questions added yet. Add your first question above.</p>
                ) : (
                  <div className="questions-list">
                    {questions.map((q, idx) => (
                      <div key={q._id} className="question-item" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'12px',border:'1px solid #eee',borderRadius:'8px',marginBottom:'8px',background:'#fafafa'}}>
                        <div style={{flex:1}}>
                          <strong>Q{idx + 1}.</strong> {q.questionText}
                          {q.questionType === 'mcq' && q.options && (
                            <div style={{marginTop:'6px',marginLeft:'24px'}}>
                              {q.options.map((opt, oi) => (
                                <div key={oi} style={{fontSize:'13px',color: opt === q.correctAnswer ? '#00612e' : '#555'}}>
                                  {String.fromCharCode(65 + oi)}. {opt} {opt === q.correctAnswer && '✓'}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.questionType === 'practical' && q.modelAnswer && (
                            <details style={{marginTop:'6px',marginLeft:'24px',fontSize:'12px'}}>
                              <summary style={{cursor:'pointer',color:'#00612e',fontWeight:600}}>Model Answer</summary>
                              <pre style={{background:'#f0faf0',padding:'8px',borderRadius:'6px',marginTop:'4px',whiteSpace:'pre-wrap',fontSize:'11px',border:'1px solid #c8e6c9'}}>{q.modelAnswer}</pre>
                            </details>
                          )}
                          {q.questionType === 'practical' && q.testCases && q.testCases.length > 0 && (
                            <div style={{marginTop:'4px',marginLeft:'24px',fontSize:'11px',color:'#555'}}>
                              <span style={{fontWeight:600}}>{q.testCases.length}</span> test case{q.testCases.length !== 1 ? 's' : ''}
                            </div>
                          )}
                          <div style={{marginTop:'4px',fontSize:'12px',color:'#888'}}>
                            Type: {q.questionType.toUpperCase()} | Marks: {q.marks}
                          </div>
                        </div>
                        <button className="btn-icon btn-delete" onClick={() => handleDeleteQuestion(q._id)} style={{marginLeft:'10px'}}>🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeQuestionManager}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== SUBMISSIONS VIEW MODAL ========== */}
      {showSubmissionsModal && submissionsExam && (
        <div className="modal-overlay" onClick={closeSubmissionsModal}>
          <div className="modal modal-submissions" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submissions — {submissionsExam.subjectName}</h3>
              <button className="modal-close" onClick={closeSubmissionsModal}>✕</button>
            </div>
            <div className="modal-body">
              {/* Summary stats */}
              <div className="submissions-summary">
                <div className="sub-stat">
                  <span className="sub-stat-num">{submissions.length}</span>
                  <span className="sub-stat-label">Total Submitted</span>
                </div>
                <div className="sub-stat">
                  <span className="sub-stat-num">{submissionsExam.totalMarks}</span>
                  <span className="sub-stat-label">Total Marks</span>
                </div>
                <div className="sub-stat">
                  <span className="sub-stat-num">{submissionsExam.examType === 'mcq' ? 'MCQ' : 'Practical'}</span>
                  <span className="sub-stat-label">Exam Type</span>
                </div>
                {submissionsExam.examType === 'practical' && (
                  <div className="sub-stat">
                    <span className="sub-stat-num">{submissionsExam.evaluationMethod === 'ai' ? '🤖 AI' : '✋ Manual'}</span>
                    <span className="sub-stat-label">Evaluation</span>
                  </div>
                )}
                {submissions.length > 0 && submissionsExam.examType === 'mcq' && (
                  <div className="sub-stat">
                    <span className="sub-stat-num">
                      {submissions.length > 0 ? Math.round(submissions.reduce((sum, s) => sum + (s.totalMarks > 0 ? (s.score / s.totalMarks) * 100 : 0), 0) / submissions.length) : 0}%
                    </span>
                    <span className="sub-stat-label">Avg Score</span>
                  </div>
                )}
              </div>

              {loadingSubmissions ? (
                <div className="loading" style={{padding:'40px'}}>Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="coming-soon" style={{padding:'40px'}}>
                  <span className="coming-icon">📋</span>
                  <h3>No Submissions Yet</h3>
                  <p>No students have submitted this exam yet.</p>
                </div>
              ) : (
                <div className="submissions-list">
                  {submissions.map((sub, idx) => {
                    const student = sub.studentId;
                    const isExpanded = expandedStudent === sub._id;
                    const percentage = sub.totalMarks > 0 ? Math.round((sub.score / sub.totalMarks) * 100) : 0;

                    return (
                      <div className="submission-row" key={sub._id}>
                        <div className="submission-header" onClick={() => setExpandedStudent(isExpanded ? null : sub._id)}>
                          <div className="submission-student">
                            <span className="sub-rank">#{idx + 1}</span>
                            <div className="sub-student-info">
                              <span className="sub-name">{student?.name || 'Unknown'}</span>
                              <span className="sub-enrollment">{student?.enrollmentNumber || '—'}</span>
                            </div>
                          </div>
                          <div className="submission-meta">
                            <span className="sub-course">{student?.course} • Sem {student?.semester}</span>
                            <span className="sub-time">{new Date(sub.submittedAt).toLocaleString()}</span>
                          </div>
                          <div className="submission-score-section">
                            {submissionsExam.examType === 'mcq' && sub.totalMarks > 0 ? (
                              <div className="sub-score-badge">
                                <span className="sub-score-num">{sub.score}</span>
                                <span className="sub-score-of">/ {sub.totalMarks}</span>
                                <span className={`sub-percentage ${percentage >= 50 ? 'pass' : 'fail'}`}>{percentage}%</span>
                              </div>
                            ) : (
                              <span className="sub-status-tag">{sub.status === 'graded' ? 'Graded' : 'Pending Review'}</span>
                            )}
                            <span className={`sub-expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="submission-detail">
                            {/* Student details row */}
                            <div className="sub-detail-student">
                              <div className="sub-detail-item"><label>Email</label><span>{student?.email || '—'}</span></div>
                              <div className="sub-detail-item"><label>Phone</label><span>{student?.phone || '—'}</span></div>
                              <div className="sub-detail-item"><label>Program</label><span>{student?.course}</span></div>
                              <div className="sub-detail-item"><label>Semester</label><span>{student?.semester}</span></div>
                            </div>

                            {/* Answers section */}
                            {sub.answers && sub.answers.length > 0 && (
                              <div className="sub-answers-section">
                                <h4>Answers ({sub.answers.length})</h4>
                                {sub.answers.map((ans, ai) => (
                                  <div className={`sub-answer-item ${submissionsExam.examType === 'mcq' ? (ans.isCorrect ? 'correct' : 'wrong') : 'practical-answer-item'}`} key={ai}>
                                    <div className="sub-answer-q">
                                      <span className="sub-q-num">Q{ai + 1}</span>
                                      <span className="sub-q-text">{ans.questionText || 'Question unavailable'}</span>
                                      <span className="sub-q-marks">{ans.marks} mark{ans.marks !== 1 ? 's' : ''}</span>
                                    </div>

                                    {submissionsExam.examType === 'mcq' ? (
                                      <>
                                        <div className="sub-answer-a">
                                          <span className="sub-a-label">Student Answer:</span>
                                          <span className={`sub-a-value ${ans.isCorrect ? 'correct-text' : 'wrong-text'}`}>
                                            {ans.answer || '(No answer)'}
                                          </span>
                                        </div>
                                        <div className="sub-answer-correct">
                                          <span className="sub-a-label">Correct Answer:</span>
                                          <span className="sub-a-value correct-text">{ans.correctAnswer}</span>
                                          <span className={`sub-result-tag ${ans.isCorrect ? 'tag-correct' : 'tag-wrong'}`}>
                                            {ans.isCorrect ? '✓ Correct' : '✗ Wrong'}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="practical-code-section">
                                        <div className="sub-answer-a" style={{flexDirection:'column',alignItems:'flex-start',gap:'8px',width:'100%'}}>
                                          <span className="sub-a-label" style={{minWidth:'auto'}}>Student Code:</span>
                                          <pre className="admin-code-block">{ans.answer || '(No code submitted)'}</pre>
                                        </div>
                                        {ans.answer && (
                                          <div className="admin-run-section">
                                            <select
                                              className="lang-select"
                                              value={adminCodeLang[`${sub._id}-${ai}`] || 'python'}
                                              onChange={(e) => setAdminCodeLang(prev => ({ ...prev, [`${sub._id}-${ai}`]: e.target.value }))}
                                            >
                                              <optgroup label="General">
                                                <option value="python">Python</option>
                                                <option value="javascript">JavaScript</option>
                                                <option value="typescript">TypeScript</option>
                                                <option value="java">Java</option>
                                                <option value="c">C</option>
                                                <option value="c++">C++</option>
                                                <option value="c#">C#</option>
                                                <option value="ruby">Ruby</option>
                                                <option value="go">Go</option>
                                                <option value="rust">Rust</option>
                                                <option value="php">PHP</option>
                                                <option value="swift">Swift</option>
                                                <option value="kotlin">Kotlin</option>
                                                <option value="r">R</option>
                                                <option value="scala">Scala</option>
                                                <option value="dart">Dart</option>
                                                <option value="perl">Perl</option>
                                                <option value="lua">Lua</option>
                                              </optgroup>
                                              <optgroup label="Frontend">
                                                <option value="html">HTML</option>
                                                <option value="css">CSS / SCSS</option>
                                                <option value="jsx">React (JSX)</option>
                                                <option value="tsx">React (TSX)</option>
                                                <option value="vue">Vue</option>
                                                <option value="svelte">Svelte</option>
                                                <option value="json">JSON</option>
                                                <option value="xml">XML</option>
                                                <option value="yaml">YAML</option>
                                              </optgroup>
                                              <optgroup label="Scripting & Shell">
                                                <option value="bash">Bash / Shell</option>
                                                <option value="sql">SQL</option>
                                                <option value="markdown">Markdown</option>
                                              </optgroup>
                                              <optgroup label="Other">
                                                <option value="haskell">Haskell</option>
                                                <option value="elixir">Elixir</option>
                                                <option value="assembly">Assembly</option>
                                                <option value="fortran">Fortran</option>
                                                <option value="pascal">Pascal</option>
                                              </optgroup>
                                            </select>
                                            <button
                                              className="btn btn-run btn-sm"
                                              onClick={() => runCodeAdmin(`${sub._id}-${ai}`, ans.answer)}
                                              disabled={adminRunningCode === `${sub._id}-${ai}`}
                                            >
                                              {adminRunningCode === `${sub._id}-${ai}` ? '⏳ Running...' : '▶ Run Code'}
                                            </button>
                                          </div>
                                        )}
                                        {adminCodeOutput[`${sub._id}-${ai}`] && !adminCodeOutput[`${sub._id}-${ai}`].running && (
                                          <div className={`code-output ${adminCodeOutput[`${sub._id}-${ai}`].isPreview ? 'output-preview' : adminCodeOutput[`${sub._id}-${ai}`].isError ? 'output-error' : 'output-success'}`}>
                                            <div className="output-header">
                                              <span className="output-title">{adminCodeOutput[`${sub._id}-${ai}`].isPreview ? '👁️ Preview' : '📤 Output'}</span>
                                              {adminCodeOutput[`${sub._id}-${ai}`].language && (
                                                <span className="output-lang">{adminCodeOutput[`${sub._id}-${ai}`].language}</span>
                                              )}
                                            </div>
                                            {adminCodeOutput[`${sub._id}-${ai}`].isPreview ? (
                                              <iframe
                                                srcDoc={adminCodeOutput[`${sub._id}-${ai}`].previewHTML}
                                                className="preview-iframe"
                                                title="Preview"
                                                sandbox="allow-scripts"
                                              />
                                            ) : (
                                              <pre className="output-content">{adminCodeOutput[`${sub._id}-${ai}`].output}</pre>
                                            )}
                                          </div>
                                        )}
                                        {adminCodeOutput[`${sub._id}-${ai}`]?.running && (
                                          <div className="code-output output-running">
                                            <span>⏳ Executing code...</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Answer file for practical */}
                            {sub.answerFile && (
                              <div className="sub-file-section">
                                <h4>Uploaded File</h4>
                                <a href={`https://online-examination-sou.onrender.com${sub.answerFile}`} target="_blank" rel="noreferrer" className="sub-file-link">
                                  📎 View Answer File
                                </a>
                              </div>
                            )}

                            {/* Auto-Score Display */}
                            {submissionsExam.examType === 'practical' && sub.answers && sub.answers.length > 0 && (
                              <div className="sub-grading-section">
                                <div className="grading-header">
                                  <h4>{sub.evaluationMethod === 'ai' ? '🤖 AI Evaluation Results' : '📊 Score'}</h4>
                                  {sub.evaluationMethod === 'ai' && sub.evaluationStrictness && (
                                    <span className="eval-strictness-tag">{sub.evaluationStrictness}</span>
                                  )}
                                </div>

                                {/* AI Evaluation Details */}
                                {sub.evaluationMethod === 'ai' && (
                                  <div className="ai-eval-details">
                                    <div className="ai-eval-scores">
                                      <div className="ai-score-card">
                                        <span className="ai-score-label">Correctness</span>
                                        <span className="ai-score-value">{sub.correctnessScore || 0}%</span>
                                      </div>
                                      <div className="ai-score-card">
                                        <span className="ai-score-label">Quality</span>
                                        <span className="ai-score-value">{sub.qualityScore || 0}%</span>
                                      </div>
                                      <div className="ai-score-card">
                                        <span className="ai-score-label">Execution</span>
                                        <span className="ai-score-value">{sub.executionTime ? `${(sub.executionTime / 1000).toFixed(2)}s` : '—'}</span>
                                      </div>
                                      <div className="ai-score-card">
                                        <span className="ai-score-label">Memory</span>
                                        <span className="ai-score-value">{sub.memoryUsed || '—'}</span>
                                      </div>
                                    </div>

                                    {/* Per-question outputs comparison */}
                                    {sub.studentOutput && sub.studentOutput.length > 0 && (
                                      <div className="ai-output-comparison">
                                        <h5>Output Comparison</h5>
                                        {sub.studentOutput.map((so, oi) => (
                                          <div className="ai-output-item" key={oi}>
                                            <span className="ai-q-label">Q{oi + 1}</span>
                                            <div className="ai-output-pair">
                                              <div className="ai-output-box expected">
                                                <span className="ai-box-label">Expected Output</span>
                                                <pre>{sub.expectedOutput?.[oi]?.output || '—'}</pre>
                                              </div>
                                              <div className={`ai-output-box student ${so.error ? 'has-error' : ''}`}>
                                                <span className="ai-box-label">Student Output</span>
                                                <pre>{so.output || so.error || '(No output)'}</pre>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* AI-Generated Ideal Solutions */}
                                    {sub.generatedSolution && sub.generatedSolution.length > 0 && (
                                      <div className="ai-solution-section">
                                        <h5>AI-Generated Ideal Solutions</h5>
                                        {sub.generatedSolution.map((gs, gi) => (
                                          <div className="ai-solution-item" key={gi}>
                                            <span className="ai-q-label">Q{gi + 1}</span>
                                            <pre className="admin-code-block">{gs.solution || '—'}</pre>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* AI Feedback */}
                                    {sub.aiFeedback && (
                                      <div className="ai-feedback-section">
                                        <h5>AI Feedback</h5>
                                        <div className="ai-feedback-content">{sub.aiFeedback}</div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Manual Grading Score Display */}
                                {sub.evaluationMethod !== 'ai' && (
                                  <div className="grading-summary">
                                    <div className="grading-total-row">
                                      <span className="grading-total-label">Score:</span>
                                      <span className="grading-total-value">
                                        {sub.score} / {sub.totalMarks}
                                      </span>
                                    </div>
                                    {sub.answers.map((ans, ai) => (
                                      <div className="grading-summary-row" key={ai}>
                                        <span className="sub-q-num">Q{ai + 1}</span>
                                        <span className="grading-q-label">
                                          {ans.answer && ans.answer.trim() ? `${ans.marks}/${ans.marks}` : `0/${ans.marks}`}
                                        </span>
                                        <span style={{fontSize:'12px',color: ans.answer && ans.answer.trim() ? '#4caf50' : '#f44336'}}>
                                          {ans.answer && ans.answer.trim() ? 'Answered' : 'No answer'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeSubmissionsModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;