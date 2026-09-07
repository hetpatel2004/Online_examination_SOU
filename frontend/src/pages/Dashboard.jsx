import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import API from '../api/axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examError, setExamError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);

  const [takingExam, setTakingExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [resultPublished, setResultPublished] = useState(false);

  const [countdown, setCountdown] = useState(null);
  const [countdownExam, setCountdownExam] = useState(null);
  const timerRef = useRef(null);

  const [codeLanguages, setCodeLanguages] = useState({});
  const [runningCode, setRunningCode] = useState(null);
  const [codeOutput, setCodeOutput] = useState({});

  const [submissions, setSubmissions] = useState({});
  const [resultCountdown, setResultCountdown] = useState(null);
  const [resultCountdownExam, setResultCountdownExam] = useState(null);
  const resultTimerRef = useRef(null);

  const [stats, setStats] = useState({
    totalExams: 0,
    upcomingExams: 0,
    attemptedExams: 0,
    totalSubjects: 0
  });

  const fetchSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/subjects?semester=${user?.semester}&course=${user?.course}`);
      setSubjects(data.subjects);
      setStats(prev => ({ ...prev, totalSubjects: data.subjects?.length || 0 }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data } = await API.get('/exams/my-submissions');
      const map = {};
      data.submissions.forEach(s => {
        if (s.examId && s.examId._id) map[s.examId._id] = s;
      });
      setSubmissions(map);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    if (activePage === 'subjects') fetchSubjects();
    if (activePage === 'exams' || activePage === 'subjectDetail') {
      fetchExams();
      fetchSubmissions();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (resultTimerRef.current) clearInterval(resultTimerRef.current);
      setCountdown(null);
      setCountdownExam(null);
      setResultCountdown(null);
      setResultCountdownExam(null);
    };
  }, [activePage]);

  const fetchExams = async () => {
    setLoadingExams(true);
    setExamError('');
    try {
      const { data } = await API.get(`/exams?semester=${user?.semester}&course=${user?.course}`);
      setExams(data.exams);
      setStats(prev => ({
        ...prev,
        totalExams: data.exams?.length || 0,
        upcomingExams: data.exams?.filter(e => getExamStatus(e) === 'upcoming').length || 0,
        attemptedExams: data.exams?.filter(e => {
          const sub = submissions[e._id];
          return sub && ((sub.answers && sub.answers.length > 0) || sub.answerFile);
        }).length || 0
      }));
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

  const isResultPublished = (exam) => {
    if (!exam.resultDate) return false;
    return new Date() >= new Date(exam.resultDate);
  };

  const startCountdown = (exam) => {
    setCountdownExam(exam);
    const examStart = new Date(`${exam.date}T${exam.time}`);
    const tick = () => {
      const diff = examStart - new Date();
      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timerRef.current);
        return;
      }
      const totalSec = Math.floor(diff / 1000);
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setCountdown({ hours, minutes, seconds });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };

  const cancelCountdown = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
    setCountdownExam(null);
  };

  const startExam = async (exam) => {
    setLoadingQuestions(true);
    try {
      const { data } = await API.get(`/exams/${exam._id}/questions`);
      setExamQuestions(data.questions);
      setTakingExam(exam);
      setAnswers({});
      setSubmission(null);
      setResultPublished(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const submitExam = async () => {
    const currentExam = takingExam;
    if (!currentExam) return;
    setSubmitting(true);
    try {
      const payload = currentExam.examType === 'practical'
        ? { answers: Object.entries(answers).map(([qid, code]) => ({ questionId: qid, answerText: code, language: codeLanguages[qid] || 'python' })) }
        : { answers: Object.entries(answers).map(([qid, ans]) => ({ questionId: qid, selectedOption: ans })) };
      const { data } = await API.post(`/exams/${currentExam._id}/submit`, payload);
      setSubmission(data.submission);
      toast.success('Exam submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const checkSubmission = (exam) => {
    const sub = submissions[exam._id];
    if (!sub) return;
    if (sub.answers && sub.answers.length > 0) {
      setTakingExam(exam);
      setExamQuestions(sub.answers.map(a => ({ _id: a.questionId })));
      setAnswers({});
      setResultPublished(isResultPublished(exam));
    } else if (sub.answerFile) {
      setTakingExam(exam);
      setSubmission(sub);
      setResultPublished(isResultPublished(exam));
    }
  };

  const renderExamCountdownUI = () => {
    if (!countdown || !countdownExam) return null;
    return (
      <div className="admin-section">
        <div className="section-header-row">
          <div>
            <h2>Exam Starting Soon — {countdownExam.subjectName}</h2>
            <p>{countdownExam.date} at {countdownExam.time}</p>
          </div>
          <button className="btn btn-secondary" onClick={cancelCountdown}>✕ Cancel</button>
        </div>
        <div className="countdown-container">
          <div className="countdown-card">
            <span className="countdown-icon">⏰</span>
            <h3>Exam starts in</h3>
            <div className="countdown-display">
              <div className="countdown-unit">
                <span className="countdown-number">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="countdown-label">Hours</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-unit">
                <span className="countdown-number">{String(countdown.minutes).padStart(2, '0')}</span>
                <span className="countdown-label">Minutes</span>
              </div>
              <span className="countdown-separator">:</span>
              <div className="countdown-unit">
                <span className="countdown-number">{String(countdown.seconds).padStart(2, '0')}</span>
                <span className="countdown-label">Seconds</span>
              </div>
            </div>
            <p className="countdown-hint">This timer will auto-start the exam when it reaches zero.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderPage = () => {
    switch (activePage) {
      case 'subjects': return renderSubjects();
      case 'exams': return renderExams();
      case 'subjectDetail': return renderSubjectDetail();
      default: return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      {renderExamCountdownUI()}
      <div className="welcome-section">
        <div className="welcome-content">
          <h1>Welcome back, {user?.name}! 👋</h1>
          <p className="welcome-subtitle">
            {user?.course} • Semester {user?.semester} • {user?.enrollmentNumber}
          </p>
        </div>
        <div className="welcome-avatar">
          {user?.name?.charAt(0)?.toUpperCase() || 'S'}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <span className="stat-number">{stats.totalExams}</span>
            <span className="stat-label">Total Exams</span>
          </div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <span className="stat-number">{stats.upcomingExams}</span>
            <span className="stat-label">Upcoming</span>
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <span className="stat-number">{stats.attemptedExams}</span>
            <span className="stat-label">Attempted</span>
          </div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <span className="stat-number">{stats.totalSubjects}</span>
            <span className="stat-label">Subjects</span>
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
            <div className="empty-state">
              <span className="empty-icon">📝</span>
              <p>No exams scheduled yet</p>
            </div>
          ) : (
            <div className="exam-list">
              {exams
                .filter(e => getExamStatus(e) === 'upcoming')
                .slice(0, 3)
                .map((exam) => (
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
            <h2>📖 My Subjects</h2>
            <button className="btn-ghost" onClick={() => setActivePage('subjects')}>View All →</button>
          </div>
          {loading ? (
            <div className="loading-skeleton">Loading...</div>
          ) : subjects.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📚</span>
              <p>No subjects assigned yet</p>
            </div>
          ) : (
            <div className="subject-list">
              {subjects.slice(0, 4).map((subject) => (
                <div key={subject._id} className="subject-item" onClick={() => { setSelectedSubject(subject); setActivePage('subjectDetail'); }}>
                  <div className="subject-item-icon">{subject.examType === 'practical' ? '💻' : '📖'}</div>
                  <div className="subject-item-info">
                    <h4>{subject.name}</h4>
                    <p>{subject.code} • Sem {subject.semester}</p>
                  </div>
                  <span className="subject-type-badge">{subject.examType === 'practical' ? 'Practical' : 'MCQ'}</span>
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
            <span className="action-icon">📝</span>
            <span>View All Exams</span>
          </button>
          <button className="action-btn" onClick={() => setActivePage('subjects')}>
            <span className="action-icon">📚</span>
            <span>My Subjects</span>
          </button>
          <button className="action-btn" onClick={() => setActivePage('change-password')}>
            <span className="action-icon">🔐</span>
            <span>Change Password</span>
          </button>
        </div>
      </div>
    </>
  );

  const renderSubjects = () => (
    <div className="admin-section">
      <div className="section-header-row">
        <div>
          <h2>My Subjects</h2>
          <p>Subjects assigned to your semester</p>
        </div>
      </div>
      {loading ? (
        <div className="loading">Loading subjects...</div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : subjects.length === 0 ? (
        <div className="coming-soon">
          <span className="coming-icon">📋</span>
          <h3>No Subjects Assigned Yet</h3>
          <p>No subjects have been assigned to your semester yet.</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {subjects.map((s) => (
            <div key={s._id} className="subject-card" onClick={() => { setSelectedSubject(s); setActivePage('subjectDetail'); }}>
              <div className="subject-icon">{s.examType === 'practical' ? '💻' : '📖'}</div>
              <h3>{s.name}</h3>
              <p>{s.code}</p>
              <span className="semester-tag">Sem {s.semester}</span>
              <span className="subject-type-badge">{s.examType === 'practical' ? 'Practical' : 'MCQ'}</span>
              {s.description && <p className="subject-desc">{s.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSubjectDetail = () => {
    if (!selectedSubject) return <div>Loading...</div>;
    return (
      <div className="admin-section">
        <div className="section-header-row">
          <button className="btn btn-secondary" onClick={() => { setSelectedSubject(null); setActivePage('subjects'); }}>← Back</button>
          <div>
            <h2>{selectedSubject.name}</h2>
            <p>{selectedSubject.code} • Semester {selectedSubject.semester} • {selectedSubject.examType === 'practical' ? 'Practical' : 'MCQ'}</p>
          </div>
        </div>
        {selectedSubject.description && <p className="subject-desc">{selectedSubject.description}</p>}
      </div>
    );
  };

  const renderExams = () => {
    return (
      <div className="admin-section">
        {renderExamCountdownUI()}
        <div className="section-header-row">
          <div>
            <h2>My Exams — Semester {user?.semester}</h2>
            <p>Exams scheduled for {user?.course} Semester {user?.semester}</p>
          </div>
        </div>
        {loadingExams ? (
          <div className="loading">Loading your exams...</div>
        ) : examError ? (
          <div className="error-msg">{examError}</div>
        ) : (
          <>
            <div className="subjects-count">
              <span className="count-badge">{exams.length} exam{exams.length !== 1 ? 's' : ''} scheduled</span>
            </div>
            {exams.length === 0 ? (
              <div className="coming-soon">
                <span className="coming-icon">📝</span>
                <h3>No Exams Scheduled</h3>
                <p>No exams have been scheduled for your semester yet. Check back later.</p>
              </div>
            ) : (
              <div className="exams-grid">
                {exams.map((exam) => {
                  const status = getExamStatus(exam);
                  const sub = submissions[exam._id];
                  const hasSubmitted = sub && ((sub.answers && sub.answers.length > 0) || sub.answerFile);
                  const resultReady = hasSubmitted && isResultPublished(exam);
                  const resultPending = hasSubmitted && !resultReady && exam.resultDate;
                  const examOver = status === 'completed';

                  let badgeClass = 'status-upcoming';
                  let badgeText = 'Upcoming';
                  if (hasSubmitted) { badgeClass = 'status-completed'; badgeText = 'Attempted'; }
                  else if (examOver) { badgeClass = 'status-completed'; badgeText = 'Missed'; }
                  else if (status === 'ongoing') { badgeClass = 'status-ongoing'; badgeText = 'LIVE Now'; }

                  return (
                    <div className={`exam-card ${status === 'ongoing' && !hasSubmitted ? 'card-live' : ''} ${hasSubmitted ? 'card-attempted' : ''} ${examOver && !hasSubmitted ? 'card-missed' : ''}`} key={exam._id}>
                      <div className="exam-card-header">
                        <div className="exam-card-icon">
                          {hasSubmitted ? '✅' : examOver ? '❌' : status === 'ongoing' ? '🔴' : '📋'}
                        </div>
                        <div className="exam-card-title">
                          <h3>{exam.subjectName}</h3>
                          <span className="exam-code">{exam.subjectCode}</span>
                        </div>
                        <span className={`exam-status ${badgeClass}`}>{badgeText}</span>
                      </div>
                      <div className="exam-card-details">
                        <div className="exam-detail"><span>📅</span> {exam.date} at {exam.time}</div>
                        <div className="exam-detail"><span>⏱</span> {exam.duration} minutes</div>
                        <div className="exam-detail"><span>📊</span> {exam.totalMarks} marks</div>
                        <div className="exam-detail"><span>📝</span> {exam.examType === 'mcq' ? 'MCQ' : 'Practical'}</div>
                        {exam.examType === 'practical' && exam.evaluationMethod === 'ai' && (
                          <div className="eval-badge">🤖 AI Evaluation ({exam.evaluationStrictness || 'medium'})</div>
                        )}
                        {exam.examType === 'practical' && exam.questionsPerStudent > 0 && (
                          <div className="exam-detail"><span>❓</span> {exam.questionsPerStudent} questions from pool of {exam.totalQuestions}</div>
                        )}
                        {exam.examType === 'mcq' && (
                          <div className="exam-detail"><span>❓</span> All {exam.totalQuestions} questions</div>
                        )}
                      </div>
                      <div className="exam-card-actions">
                        {hasSubmitted && resultReady && (
                          <div className="result-box">
                            <span className="score-display">{sub.score}/{sub.totalMarks}</span>
                            <button className="btn btn-primary btn-sm" onClick={() => checkSubmission(exam)}>View Result</button>
                          </div>
                        )}
                        {resultPending && (
                          <div className="result-pending-box">
                            <ExamResultTimer exam={exam} />
                            <button className="btn btn-secondary btn-sm" onClick={() => checkSubmission(exam)}>View Submission</button>
                          </div>
                        )}
                        {hasSubmitted && !exam.resultDate && (
                          <button className="btn btn-secondary btn-sm" onClick={() => checkSubmission(exam)}>View Submission</button>
                        )}
                        {!hasSubmitted && status === 'upcoming' && (
                          <button className="btn btn-primary btn-sm" onClick={() => startCountdown(exam)} disabled={loadingQuestions}>⏰ Set Timer</button>
                        )}
                        {!hasSubmitted && status === 'ongoing' && (
                          <button className="btn btn-primary btn-sm btn-live" onClick={() => startExam(exam)} disabled={loadingQuestions}>🔴 Take Exam</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-page dashboard-layout">
      <Sidebar role="user" activePage={activePage} onNavigate={setActivePage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <nav className="dashboard-nav">
          <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
          <div className="nav-brand"><span className="student-badge">STUDENT PANEL</span></div>
          <div className="nav-welcome">Welcome, {user?.name}</div>
        </nav>
        <div className="dashboard-content">{renderPage()}</div>
      </div>
    </div>
  );
};

// Small component for result countdown on exam cards
const ExamResultTimer = ({ exam }) => {
  const [cd, setCd] = useState(null);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(exam.resultDate) - new Date();
      if (diff <= 0) { setCd(null); return true; }
      const totalSec = Math.floor(diff / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setCd({ days, hours, minutes, seconds });
      return false;
    };
    const done = calc();
    if (done) return;
    const interval = setInterval(() => { const done = calc(); if (done) clearInterval(interval); }, 1000);
    return () => clearInterval(interval);
  }, [exam.resultDate]);

  if (!cd) return <span className="result-ready-text">Results published!</span>;

  return (
    <div className="card-result-countdown">
      <span className="card-cd-label">Results in</span>
      <div className="card-cd-display">
        {cd.days > 0 && (<> <span className="card-cd-num">{String(cd.days).padStart(2, '0')}</span> <span className="card-cd-sep">d</span> </>)}
        <span className="card-cd-num">{String(cd.hours).padStart(2, '0')}</span>
        <span className="card-cd-sep">h</span>
        <span className="card-cd-num">{String(cd.minutes).padStart(2, '0')}</span>
        <span className="card-cd-sep">m</span>
        <span className="card-cd-num">{String(cd.seconds).padStart(2, '0')}</span>
        <span className="card-cd-sep">s</span>
      </div>
    </div>
  );
};

export default Dashboard;