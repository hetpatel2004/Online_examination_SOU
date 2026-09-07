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

  const [uploadingFile, setUploadingFile] = useState(false);

  // Code execution state (for practical exams)
  const [codeLanguages, setCodeLanguages] = useState({});
  const [runningCode, setRunningCode] = useState(null);
  const [codeOutput, setCodeOutput] = useState({});

  // All submissions for this student (keyed by examId)
  const [submissions, setSubmissions] = useState({});
  // Result countdown on a specific exam (after submit or on card)
  const [resultCountdown, setResultCountdown] = useState(null);
  const [resultCountdownExam, setResultCountdownExam] = useState(null);
  const resultTimerRef = useRef(null);

  const fetchSubjects = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/subjects?semester=${user?.semester}&course=${user?.course}`);
      setSubjects(data.subjects);
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
    } catch (err) {
      setExamError(err.response?.data?.message || 'Failed to load exams');
    } finally {
      setLoadingExams(false);
    }
  };

  const getExamStatus = (exam) => {
    const examStart = new Date(`${exam.date}T${exam.time}`);
    const examEnd = new Date(examStart.getTime() + exam.duration * 60000);
    const now = new Date();
    if (now < examStart) return 'upcoming';
    if (now <= examEnd) return 'ongoing';
    return 'completed';
  };

  const getTimeUntilStart = (exam) => {
    const examStart = new Date(`${exam.date}T${exam.time}`);
    return examStart - new Date();
  };

  const formatCountdown = (ms) => {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds, total: ms };
  };

  // ---- Start countdown for exam start ----
  const startCountdown = (exam) => {
    const timeLeft = getTimeUntilStart(exam);
    if (timeLeft <= 0) {
      startExam(exam);
      return;
    }
    setCountdownExam(exam);
    setCountdown(formatCountdown(timeLeft));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = getTimeUntilStart(exam);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(null);
        setCountdownExam(null);
        startExam(exam);
      } else {
        setCountdown(formatCountdown(remaining));
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
    setCountdownExam(null);
  };

  // ---- Start countdown for result date ----
  const getResultTimeLeft = (exam) => {
    if (!exam?.resultDate) return null;
    const diff = new Date(exam.resultDate) - new Date();
    return diff;
  };

  const startResultCountdown = (exam) => {
    if (!exam?.resultDate) return;
    const timeLeft = getResultTimeLeft(exam);
    if (timeLeft !== null && timeLeft <= 0) {
      setResultCountdown(null);
      setResultCountdownExam(null);
      return;
    }
    setResultCountdownExam(exam);
    setResultCountdown(formatCountdown(timeLeft));
    if (resultTimerRef.current) clearInterval(resultTimerRef.current);
    resultTimerRef.current = setInterval(() => {
      const remaining = getResultTimeLeft(exam);
      if (remaining !== null && remaining <= 0) {
        clearInterval(resultTimerRef.current);
        resultTimerRef.current = null;
        setResultCountdown(null);
        setResultCountdownExam(null);
        toast.success('Results are now published!');
        fetchSubmissions();
      } else if (remaining !== null) {
        setResultCountdown(formatCountdown(remaining));
      }
    }, 1000);
  };

  const isResultPublished = (exam) => {
    if (!exam?.resultDate) return false;
    return new Date() >= new Date(exam.resultDate);
  };

  const startExam = async (exam) => {
    const existingSub = submissions[exam._id];
    const alreadySubmitted = existingSub && ((existingSub.answers && existingSub.answers.length > 0) || existingSub.answerFile);
    if (alreadySubmitted) {
      checkSubmission(exam);
      return;
    }
    setSubmission(null);
    setResultPublished(false);
    setExamQuestions([]);
    setTakingExam(exam);
    setAnswers({});
    setLoadingQuestions(true);
    try {
      const { data } = await API.get(`/exams/${exam._id}/questions`);
      if (!data.questions || data.questions.length === 0) {
        toast.warning(data.message || 'No questions available for this exam.');
        setTakingExam(null);
        setLoadingQuestions(false);
        return;
      }
      setExamQuestions(data.questions);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load exam questions');
      setTakingExam(null);
      setExamQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const checkSubmission = async (exam) => {
    try {
      const { data } = await API.get(`/exams/${exam._id}/submission`);
      setSubmission(data.submission);
      setResultPublished(data.resultPublished || false);
      setTakingExam(exam);
      if (!data.resultPublished && exam.resultDate) {
        startResultCountdown(exam);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to check submission');
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const submitExam = async () => {
    if (!takingExam) return;
    const answerArray = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    if (answerArray.length === 0) {
      toast.warning('Please answer at least one question before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const submitPayload = { answers: answerArray };
      if (takingExam.examType === 'practical') {
        const firstQId = Object.keys(answers)[0];
        const selectedLang = codeLanguages[firstQId];
        if (!selectedLang) {
          toast.error('Please select a programming language before submitting.');
          setSubmitting(false);
          return;
        }
        submitPayload.language = selectedLang;
      }
      const { data } = await API.post(`/exams/${takingExam._id}/submit`, submitPayload);
      toast.success('Exam submitted successfully!');
      // Build submission object for immediate display
      const subData = data.submission;
      setSubmission({
        submittedAt: subData.submittedAt,
        totalMarks: subData.totalMarks,
        score: subData.score,
        status: subData.status || 'submitted',
        evaluationMethod: subData.evaluationMethod || null,
        correctnessScore: subData.correctnessScore,
        qualityScore: subData.qualityScore,
        executionTime: subData.executionTime,
        memoryUsed: subData.memoryUsed,
        aiFeedback: subData.aiFeedback,
        passed: subData.passed,
      });
      setExamQuestions([]);
      setAnswers({});
      // Start result countdown if resultDate is set
      if (takingExam.resultDate) {
        startResultCountdown(takingExam);
      }
      fetchSubmissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit exam');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (examId, file) => {
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('answerFile', file);
      await API.post(`/exams/${examId}/submit-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('File uploaded successfully!');
      fetchSubmissions();
      fetchExams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'File upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const runCode = async (questionId) => {
    const code = answers[questionId] || '';
    if (!code.trim()) {
      toast.warning('Please write some code first');
      return;
    }
    const lang = codeLanguages[questionId] || 'python';
    setRunningCode(questionId);
    setCodeOutput(prev => ({ ...prev, [questionId]: { running: true } }));
    try {
      const { data } = await API.post('/exams/run-code', { code, language: lang });

      // Preview languages (HTML/CSS) → show iframe
      if (data.status === 'preview' && data.previewHTML) {
        setCodeOutput(prev => ({
          ...prev,
          [questionId]: {
            running: false,
            isPreview: true,
            previewHTML: data.previewHTML,
            language: data.language,
          }
        }));
        return;
      }

      const output = data.stdout || data.stderr || data.compile_output || '';
      const hasError = data.status === 'error' || data.stderr || data.compile_output;
      setCodeOutput(prev => ({
        ...prev,
        [questionId]: {
          running: false,
          output: output.trim() || '(No output)',
          isError: !!hasError,
          language: data.language,
        }
      }));
    } catch (err) {
      setCodeOutput(prev => ({
        ...prev,
        [questionId]: { running: false, output: err.response?.data?.message || 'Execution failed', isError: true }
      }));
    } finally {
      setRunningCode(null);
    }
  };

  const exitExam = () => {
    setTakingExam(null);
    setExamQuestions([]);
    setAnswers({});
    setSubmission(null);
    setResultPublished(false);
    if (resultTimerRef.current) clearInterval(resultTimerRef.current);
    resultTimerRef.current = null;
    setResultCountdown(null);
    setResultCountdownExam(null);
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
            <p className="countdown-info">{countdownExam.examType === 'mcq' ? 'MCQ' : 'Practical'} Exam • {countdownExam.duration} mins • {countdownExam.totalMarks} marks</p>
            <p className="countdown-hint">The exam will start automatically when the timer reaches zero.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderExamTakingUI = () => {
    if (!takingExam || submission) return null;
    return (
      <div className="admin-section">
        <div className="section-header-row">
          <div>
            <h2>{takingExam.subjectName} — {takingExam.examType === 'mcq' ? 'MCQ Exam' : 'Practical Exam'}</h2>
            <p>Duration: {takingExam.duration} mins | Total Marks: {takingExam.totalMarks}</p>
          </div>
          <button className="btn btn-secondary" onClick={exitExam}>✕ Exit Exam</button>
        </div>
        {loadingQuestions ? (
          <div className="loading">Loading questions...</div>
        ) : examQuestions.length === 0 ? (
          <div className="coming-soon">
            <span className="coming-icon">📝</span>
            <h3>No Questions Available</h3>
            <p>This exam does not have any questions yet.</p>
          </div>
        ) : (
          <div className="exam-questions-container">
            {examQuestions.map((q, idx) => (
              <div className="question-card" key={q._id}>
                <div className="question-header">
                  <span className="question-number">Q{idx + 1}</span>
                  <span className="question-marks">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                </div>
                <p className="question-text">{q.questionText}</p>
                {q.questionType === 'mcq' && q.options && (
                  <div className="options-container">
                    {q.options.map((opt, oi) => (
                      <label key={oi} className={`option-label ${answers[q._id] === opt ? 'selected' : ''}`}>
                        <input type="radio" name={`q-${q._id}`} value={opt} checked={answers[q._id] === opt} onChange={() => handleAnswerChange(q._id, opt)} />
                        <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
                        <span className="option-text">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {(q.questionType === 'practical' || !q.questionType) && (
                  <div className="practical-answer">
                    <div className="lang-select-row">
                      <label className="lang-label">Language:</label>
                      <select
                        className="lang-select"
                        value={codeLanguages[q._id] || 'python'}
                        onChange={(e) => setCodeLanguages({ ...codeLanguages, [q._id]: e.target.value })}
                      >
                        <optgroup label="Backend">
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="c">C</option>
                          <option value="cpp">C++</option>
                          <option value="csharp">C#</option>
                          <option value="go">Go</option>
                          <option value="rust">Rust</option>
                          <option value="php">PHP</option>
                          <option value="ruby">Ruby</option>
                          <option value="kotlin">Kotlin</option>
                          <option value="swift">Swift</option>
                          <option value="scala">Scala</option>
                          <option value="r">R</option>
                        </optgroup>
                        <optgroup label="Frontend">
                          <option value="javascript">JavaScript</option>
                          <option value="jsx">React (JSX)</option>
                          <option value="typescript">TypeScript</option>
                          <option value="tsx">React (TSX)</option>
                          <option value="html">HTML</option>
                          <option value="css">CSS</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option value="sql">SQL</option>
                          <option value="bash">Bash</option>
                          <option value="haskell">Haskell</option>
                        </optgroup>
                      </select>
                    </div>
                    <textarea
                      className="code-textarea"
                      placeholder="// Write your code here..."
                      value={answers[q._id] || ''}
                      onChange={(e) => handleAnswerChange(q._id, e.target.value)}
                      rows="8"
                      spellCheck="false"
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="submit-exam-bar">
              <p>Answered: {Object.keys(answers).length} / {examQuestions.length} questions</p>
              <button className="btn btn-primary" onClick={submitExam} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSubmissionResultUI = () => {
    if (!submission) return null;
    const isAIEvaluated = submission.evaluationMethod === 'ai';
    return (
      <div className="admin-section">
        <div className="section-header-row">
          <div>
            <h2>Exam Submitted — {takingExam?.subjectName || 'Exam'}</h2>
          </div>
          <button className="btn btn-secondary" onClick={exitExam}>Back to Exams</button>
        </div>
        <div className="submission-result">
          <div className="result-card">
            {/* Score/result card shown only after the admin's result date has passed */}
            {resultPublished ? (
              <>
                <span className="result-icon">{submission.passed ? '🎉' : submission.score > 0 ? '📊' : '📝'}</span>
                <h3>Results Published!</h3>

                {isAIEvaluated ? (
                  <div className="ai-student-result">
                    <div className="ai-student-scores">
                      <div className="ai-student-score-card main">
                        <span className="ai-score-value big">{submission.score}<span className="ai-score-of"> / {submission.totalMarks}</span></span>
                        <span className="ai-score-label">Final Marks</span>
                      </div>
                      <div className="ai-student-score-card">
                        <span className="ai-score-value">{submission.correctnessScore || 0}%</span>
                        <span className="ai-score-label">Correctness</span>
                      </div>
                      <div className="ai-student-score-card">
                        <span className="ai-score-value">{submission.qualityScore || 0}%</span>
                        <span className="ai-score-label">Code Quality</span>
                      </div>
                    </div>
                    <div className="ai-student-meta">
                      {submission.executionTime > 0 && (
                        <span className="ai-meta-item">⏱️ Execution: {(submission.executionTime / 1000).toFixed(2)}s</span>
                      )}
                      {submission.memoryUsed && (
                        <span className="ai-meta-item">💾 Memory: {submission.memoryUsed}</span>
                      )}
                      <span className={`ai-meta-item ${submission.passed ? 'passed' : 'failed'}`}>
                        {submission.passed ? '✅ Passed' : '❌ Not Passed'}
                      </span>
                    </div>
                    {submission.aiFeedback && (
                      <div className="ai-student-feedback">
                        <h4>Feedback</h4>
                        <p>{submission.aiFeedback}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {submission.totalMarks > 0 && (
                      <div className="score-display">
                        <span className="score-number">{submission.score}</span>
                        <span className="score-divider">/</span>
                        <span className="score-total">{submission.totalMarks}</span>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <span className="result-icon">✅</span>
                <h3>Exam Submitted Successfully!</h3>
                {isAIEvaluated && (
                  <p style={{ color: '#2878B5', fontSize: '13px', margin: '8px 0', background: '#E8F3EC', padding: '8px 14px', borderRadius: '8px' }}>
                    🤖 This exam uses AI evaluation. Your code is being analyzed for correctness and quality. Results will appear after the result date.
                  </p>
                )}
                <p style={{ color: '#666', fontSize: '15px', margin: '12px 0' }}>
                  Your submission has been recorded.
                </p>
                {takingExam?.resultDate && (
                  <>
                    {resultCountdown && resultCountdownExam?._id === takingExam?._id ? (
                      <div className="result-countdown-box">
                        <p style={{ color: '#888', fontSize: '13px', marginBottom: '8px' }}>Results will be published in:</p>
                        <div className="result-countdown-display">
                          {resultCountdown.days > 0 && (
                            <span className="rc-unit">
                              <span className="rc-num">{String(resultCountdown.days).padStart(2, '0')}</span>
                              <span className="rc-label">Days</span>
                            </span>
                          )}
                          {resultCountdown.days > 0 && <span className="rc-sep">:</span>}
                          <span className="rc-unit">
                            <span className="rc-num">{String(resultCountdown.hours).padStart(2, '0')}</span>
                            <span className="rc-label">Hrs</span>
                          </span>
                          <span className="rc-sep">:</span>
                          <span className="rc-unit">
                            <span className="rc-num">{String(resultCountdown.minutes).padStart(2, '0')}</span>
                            <span className="rc-label">Min</span>
                          </span>
                          <span className="rc-sep">:</span>
                          <span className="rc-unit">
                            <span className="rc-num">{String(resultCountdown.seconds).padStart(2, '0')}</span>
                            <span className="rc-label">Sec</span>
                          </span>
                        </div>
                        <p style={{ color: '#aaa', fontSize: '12px', marginTop: '6px' }}>
                          Result date: {new Date(takingExam.resultDate).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>
                        📅 Result date: {new Date(takingExam.resultDate).toLocaleString()}
                      </p>
                    )}
                  </>
                )}
                {!takingExam?.resultDate && (
                  <p style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>
                    Results will be announced on the scheduled result date by the admin.
                  </p>
                )}
                {/* Lock note: answer review & marks stay hidden until the result date */}
                {takingExam?.resultDate && (
                  <div className="result-locked-box" style={{ marginTop: '14px', padding: '10px 14px', background: '#FFF7E6', border: '1px solid #FFD08A', borderRadius: '8px', color: '#8A5A00', fontSize: '13px' }}>
                    🔒 Answer review and marks will be visible on{' '}
                    <strong>{new Date(takingExam.resultDate).toLocaleString()}</strong>
                  </div>
                )}
              </>
            )}
            {/* Per-question answer review — revealed only once results are published */}
            {resultPublished && ((submission.answers && submission.answers.length > 0) || (submission.submittedCode && submission.submittedCode.length > 0)) ? (
              <div className="result-answers-section">
                <h4>Answer Review</h4>
                <div className="result-answers-list">
                  {submission.answers && submission.answers.map((ans, idx) => (
                    <div key={idx} className={`result-answer-item ${ans.isCorrect ? 'correct' : 'incorrect'}`}>
                      <div className="ra-header">
                        <span className="ra-number">Q{idx + 1}</span>
                        {ans.marks > 0 && <span className="ra-marks">{ans.marks} mark{ans.marks !== 1 ? 's' : ''}</span>}
                        <span className={`ra-verdict ${ans.isCorrect ? 'correct' : 'incorrect'}`}>
                          {ans.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                        </span>
                      </div>
                      <p className="ra-question">{ans.questionText || 'Question'}</p>
                      {ans.options && ans.options.length > 0 ? (
                        <div className="ra-answer-compare">
                          <div className="ra-answer-block wrong">
                            <strong>Your answer:</strong>
                            <span className={`sub-a-value ${ans.isCorrect ? 'text-correct' : 'text-incorrect'}`}>
                              {ans.answer || '(No answer)'}
                            </span>
                          </div>
                          <div className="ra-answer-block correct">
                            <strong>Correct answer:</strong>
                            <span className="text-correct">{ans.correctAnswer}</span>
                            <span className={`ra-verdict ${ans.isCorrect ? 'correct' : 'incorrect'}`} style={{marginLeft:'12px',fontSize:'12px'}}>
                              {ans.isCorrect ? '✅ Correct' : '❌ Incorrect'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="ra-answer-compare">
                          <div className="ra-answer-block wrong">
                            <strong>Your answer:</strong>
                            <pre className={ans.isCorrect ? 'text-correct' : 'text-incorrect'}>{ans.answer || '(Not answered)'}</pre>
                          </div>
                          {!ans.isCorrect && (
                            <div className="ra-answer-block correct">
                              <strong>Correct answer:</strong>
                              <pre className="text-correct">{ans.correctAnswer || '(No model answer provided)'}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {submission.submittedCode && submission.submittedCode.map((sc, idx) => {
                    if (submission.answers?.some(a => a.questionId?.toString() === sc.questionId?.toString())) return null;
                    return (
                      <div key={'code-' + idx} className="result-answer-item">
                        <div className="ra-header">
                          <span className="ra-number">Q{idx + 1}</span>
                          <span className="ra-marks">{sc.language}</span>
                        </div>
                        <div className="ra-answer-compare">
                          <div className="ra-answer-block">
                            <strong>Submitted code:</strong>
                            <pre>{sc.code || '(No code)'}</pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="submitted-at">Submitted: {new Date(submission.submittedAt).toLocaleString()}</p>
            {submission.answerFile && (
              <p className="submitted-at">Answer file uploaded ✓</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPage = () => {
    const countdownUI = renderExamCountdownUI();
    const takingUI = renderExamTakingUI();
    const submissionUI = renderSubmissionResultUI();
    if (countdownUI) return countdownUI;
    if (takingUI) return takingUI;
    if (submissionUI) return submissionUI;

    switch (activePage) {
      case 'subjects':
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>My Subjects — Semester {user?.semester}</h2>
                <p>Subjects assigned to your semester ({user?.course})</p>
              </div>
            </div>
            {loading ? (
              <div className="loading">Loading your subjects...</div>
            ) : error ? (
              <div className="error-msg">{error}</div>
            ) : (
              <>
                <div className="subjects-count">
                  <span className="count-badge">{subjects.length} subject{subjects.length !== 1 ? 's' : ''} found</span>
                </div>
                {subjects.length === 0 ? (
                  <div className="coming-soon">
                    <span className="coming-icon">📖</span>
                    <h3>No Subjects Found</h3>
                    <p>No subjects have been assigned to Semester {user?.semester} yet. Contact your admin.</p>
                  </div>
                ) : (
                  <div className="subjects-grid">
                    {subjects.map((subject) => (
                      <div className="subject-card clickable" key={subject._id} onClick={() => { setSelectedSubject(subject); setActivePage('subjectDetail'); fetchExams(); fetchSubmissions(); }}>
                        <div className="subject-icon">📘</div>
                        <h3>{subject.name}</h3>
                        <p>Code: {subject.code}</p>
                        <p className="subject-desc">{subject.description || 'No description available'}</p>
                        <span className="subject-status">Semester {subject.semester} • {subject.course}</span>
                        <div className="subject-card-hover">
                          <span>View Exams →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'subjectDetail':
        if (!selectedSubject) { setActivePage('subjects'); return null; }
        const subjectExams = exams.filter(e => e.subjectCode === selectedSubject.code);
        return (
          <div className="admin-section">
            <div className="section-header-row">
              <div>
                <h2>{selectedSubject.name}</h2>
                <p>{selectedSubject.description || 'No description'} — Code: {selectedSubject.code} | Semester {selectedSubject.semester} • {selectedSubject.course}</p>
              </div>
              <button className="btn btn-secondary" onClick={() => { setSelectedSubject(null); setActivePage('subjects'); }}>
                ← Back to Subjects
              </button>
            </div>
            {loadingExams ? (
              <div className="loading">Loading exams...</div>
            ) : examError ? (
              <div className="error-msg">{examError}</div>
            ) : subjectExams.length === 0 ? (
              <div className="coming-soon">
                <span className="coming-icon">📝</span>
                <h3>No Exams for This Subject</h3>
                <p>There are no exams scheduled for {selectedSubject.name} yet.</p>
              </div>
            ) : (
              <>
                <div className="subjects-count">
                  <span className="count-badge">{subjectExams.length} exam{subjectExams.length !== 1 ? 's' : ''} found for this subject</span>
                </div>
                <div className="subjects-grid">
                  {subjectExams.map((exam) => {
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
                      <div className={`subject-card ${status === 'ongoing' && !hasSubmitted ? 'card-live' : ''} ${hasSubmitted ? 'card-attempted' : ''} ${examOver && !hasSubmitted ? 'card-missed' : ''}`} key={exam._id}>
                        <div className="subject-icon">{hasSubmitted ? '✅' : examOver ? '❌' : status === 'ongoing' ? '🔴' : '📋'}</div>
                        <h3>{exam.subjectName}</h3>
                        <p>Code: {exam.subjectCode}</p>
                        <div className="exam-details">
                          <p>📅 {exam.date} at {exam.time}</p>
                          <p>⏱ {exam.duration} minutes</p>
                          <p>📊 {exam.totalMarks} marks</p>
                          <p>📝 Type: {exam.examType === 'mcq' ? 'MCQ' : 'Practical'}</p>
                          {exam.examType === 'practical' && (
                            <p>{exam.evaluationMethod === 'ai' ? '🤖 AI Evaluation' : '✋ Manual Grading'}</p>
                          )}
                        </div>
                        <div className="exam-actions">
                          <span className={`exam-status ${badgeClass}`}>{badgeText}</span>
                          {hasSubmitted && resultReady && (
                            <div className="result-ready-badge">
                              <span className="score-mini">{sub.score}/{sub.totalMarks}</span>
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
              </>
            )}
          </div>
        );

      case 'exams':
        // EXAM LIST UI
        return (
          <div className="admin-section">
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
                  <div className="subjects-grid">
                    {exams.map((exam) => {
                      const status = getExamStatus(exam);
                      const sub = submissions[exam._id];
                      const hasSubmitted = sub && ((sub.answers && sub.answers.length > 0) || sub.answerFile);
                      const resultReady = hasSubmitted && isResultPublished(exam);
                      const resultPending = hasSubmitted && !resultReady && exam.resultDate;
                      const examOver = status === 'completed';

                      // Badge logic
                      let badgeClass = 'status-upcoming';
                      let badgeText = 'Upcoming';
                      if (hasSubmitted) {
                        badgeClass = 'status-completed';
                        badgeText = 'Attempted';
                      } else if (examOver) {
                        badgeClass = 'status-completed';
                        badgeText = 'Missed';
                      } else if (status === 'ongoing') {
                        badgeClass = 'status-ongoing';
                        badgeText = 'LIVE Now';
                      }

                      return (
                        <div className={`subject-card ${status === 'ongoing' && !hasSubmitted ? 'card-live' : ''} ${hasSubmitted ? 'card-attempted' : ''} ${examOver && !hasSubmitted ? 'card-missed' : ''}`} key={exam._id}>
                          <div className="subject-icon">
                            {hasSubmitted ? '✅' : examOver ? '❌' : status === 'ongoing' ? '🔴' : '📋'}
                          </div>
                          <h3>{exam.subjectName}</h3>
                          <p>Code: {exam.subjectCode}</p>
                          <div className="exam-details">
                            <p>📅 {exam.date} at {exam.time}</p>
                            <p>⏱ {exam.duration} minutes</p>
                            <p>📊 {exam.totalMarks} marks</p>
                            <p>📝 Type: {exam.examType === 'mcq' ? 'MCQ' : 'Practical'}</p>
                            {exam.examType === 'practical' && exam.evaluationMethod === 'ai' && (
                              <p className="eval-method-badge">🤖 AI Evaluation ({exam.evaluationStrictness || 'medium'})</p>
                            )}
                            {exam.examType === 'practical' && exam.evaluationMethod !== 'ai' && (
                              <p>✋ Manual Grading</p>
                            )}
                            {exam.examType === 'practical' && exam.questionsPerStudent > 0 && (
                              <p>❓ {exam.questionsPerStudent} questions from pool of {exam.totalQuestions}</p>
                            )}
                            {exam.examType === 'mcq' && (
                              <p>❓ All {exam.totalQuestions} questions</p>
                            )}
                          </div>

                          <div className="exam-actions">
                            {/* BADGE */}
                            <span className={`exam-status ${badgeClass}`}>{badgeText}</span>

                            {/* ATTEMPTED + RESULT READY → show score */}
                            {hasSubmitted && resultReady && (
                              <div className="result-ready-badge">
                                <span className="score-mini">{sub.score}/{sub.totalMarks}</span>
                                <button className="btn btn-primary btn-sm" onClick={() => checkSubmission(exam)}>
                                  View Result
                                </button>
                              </div>
                            )}

                            {/* ATTEMPTED + RESULT PENDING → countdown to result */}
                            {resultPending && (
                              <div className="result-pending-box">
                                <ExamResultTimer exam={exam} />
                                <button className="btn btn-secondary btn-sm" onClick={() => checkSubmission(exam)}>
                                  View Submission
                                </button>
                              </div>
                            )}

                            {/* ATTEMPTED + NO RESULT DATE SET */}
                            {hasSubmitted && !exam.resultDate && (
                              <button className="btn btn-secondary btn-sm" onClick={() => checkSubmission(exam)}>
                                View Submission
                              </button>
                            )}

                            {/* NOT SUBMITTED + UPCOMING → Set Timer */}
                            {!hasSubmitted && status === 'upcoming' && (
                              <button className="btn btn-primary btn-sm" onClick={() => startCountdown(exam)} disabled={loadingQuestions}>
                                ⏰ Set Timer
                              </button>
                            )}

                            {/* NOT SUBMITTED + ONGOING → Take Exam */}
                            {!hasSubmitted && status === 'ongoing' && (
                              <button className="btn btn-primary btn-sm btn-live" onClick={() => startExam(exam)} disabled={loadingQuestions}>
                                🔴 Take Exam
                              </button>
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

      default:
        return (
          <>
            <div className="welcome-section">
              <h1>Welcome, {user?.name}!</h1>
              <p>Semester {user?.semester} | {user?.course} | Enrollment: {user?.enrollmentNumber}</p>
            </div>
            <div className="student-info">
              <h2>Your Profile</h2>
              <div className="info-grid">
                <div className="info-item"><label>Name</label><span>{user?.name}</span></div>
                <div className="info-item"><label>Enrollment No</label><span>{user?.enrollmentNumber}</span></div>
                <div className="info-item"><label>Email</label><span>{user?.email}</span></div>
                <div className="info-item"><label>Phone</label><span>{user?.phone}</span></div>
                <div className="info-item"><label>Program</label><span>{user?.course}</span></div>
                <div className="info-item"><label>Semester</label><span className="semester-highlight">{user?.semester}</span></div>
              </div>
            </div>
            <div className="subjects-section">
              <h2>Your Semester — {user?.course} Semester {user?.semester}</h2>
              <p className="section-subtitle">Click "My Subjects" in the sidebar to view your subjects</p>
              <div className="subjects-grid">
                <div className="subject-card clickable" onClick={() => setActivePage('subjects')}>
                  <div className="subject-icon">📖</div>
                  <h3>View My Subjects</h3>
                  <p>Browse subjects assigned to your semester</p>
                  <span className="subject-status">Click to view →</span>
                </div>
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="dashboard-page dashboard-layout">
      <Sidebar role="user" activePage={activePage} onNavigate={setActivePage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      <div className="dashboard-main">
        <nav className="dashboard-nav">
          <button className="hamburger dash-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
          <div className="nav-brand">
            <span className="student-badge">STUDENT PANEL</span>
          </div>
          <div className="nav-welcome">Welcome, {user?.name}</div>
        </nav>
        <div className="dashboard-content">
          {renderPage()}
        </div>
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
      if (diff <= 0) {
        setCd(null);
        return true;
      }
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
    const interval = setInterval(() => {
      const done = calc();
      if (done) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [exam.resultDate]);

  if (!cd) {
    return <span className="result-ready-text">Results published!</span>;
  }

  return (
    <div className="card-result-countdown">
      <span className="card-cd-label">Results in</span>
      <div className="card-cd-display">
        {cd.days > 0 && (
          <>
            <span className="card-cd-num">{String(cd.days).padStart(2, '0')}</span>
            <span className="card-cd-sep">d</span>
          </>
        )}
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
