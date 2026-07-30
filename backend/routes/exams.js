const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const auth = require('../middleware/auth');
const { executeCode, PISTON_LANGUAGES } = require('../services/codeExecution');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'answers');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

/**
 * GET /api/exams
 * Fetch scheduled exams (any logged-in user)
 */
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.course) filter.course = req.query.course;

    const exams = await Exam.find(filter).sort({ date: 1, time: 1 }).lean();
    res.json({ exams });
  } catch (error) {
    console.error('Error fetching exams:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/exams/my-submissions
 * Returns all submissions for the logged-in student so the frontend
 * knows which exams are already submitted.
 */
router.get('/my-submissions', auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ studentId: req.user.id })
      .select('examId score totalMarks submittedAt status answerFile answers')
      .populate('examId', 'resultDate date time duration subjectName subjectCode examType totalMarks')
      .lean();
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/exams/:examId/questions
 * Student starts exam → random subset of questions picked from pool.
 * Stores assigned questions in submission so same student always gets same set.
 * Does NOT return correctAnswer.
 */
router.get('/:examId/questions', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    console.log(`[QUESTIONS] Exam ${exam._id}: type=${exam.examType}, questionsPerStudent=${exam.questionsPerStudent} (typeof=${typeof exam.questionsPerStudent})`);

    // Check if student already has a submission (already started)
    let submission = await Submission.findOne({ examId: req.params.examId, studentId: req.user.id });

    let assignedQuestionIds;

    if (submission && submission.assignedQuestions && submission.assignedQuestions.length > 0) {
      // Student already started — check if we need to reassign due to questionsPerStudent change
      const qps = Number(exam.questionsPerStudent) || 0;
      const needReassign = exam.examType !== 'mcq'
        && qps > 0
        && submission.assignedQuestions.length > qps;

      console.log(`[QUESTIONS] Student ${req.user.id}: existing submission with ${submission.assignedQuestions.length} questions, qps=${qps}, needReassign=${needReassign}`);

      if (!needReassign) {
        // Return same assigned questions
        assignedQuestionIds = submission.assignedQuestions;
      }
      // else: fall through to reassign below
    }

    if (!assignedQuestionIds) {
      // First time OR reassigning due to questionsPerStudent change
      const allQuestions = await Question.find(
        { examId: req.params.examId },
        { _id: 1, marks: 1 }
      ).lean();
      if (allQuestions.length === 0) {
        return res.json({ questions: [], examType: exam.examType, message: 'No questions available for this exam yet. Please contact your admin.' });
      }

      // MCQ: all students get ALL questions, just shuffled sequence
      // Practical: student gets random subset based on questionsPerStudent
      let selected;
      const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());

      if (exam.examType === 'mcq') {
        selected = shuffled;
      } else {
        const qps = Number(exam.questionsPerStudent) || 0;
        const count = qps > 0 ? qps : allQuestions.length;
        selected = shuffled.slice(0, Math.min(count, allQuestions.length));
      }
      assignedQuestionIds = selected.map(q => q._id);

      if (submission) {
        submission.assignedQuestions = assignedQuestionIds;
        submission.totalMarks = selected.reduce((sum, q) => sum + q.marks, 0);
        await submission.save();
      } else {
        try {
          submission = new Submission({
            examId: req.params.examId,
            studentId: req.user.id,
            assignedQuestions: assignedQuestionIds,
            totalMarks: selected.reduce((sum, q) => sum + q.marks, 0)
          });
          await submission.save();
        } catch (saveErr) {
          submission = await Submission.findOne({ examId: req.params.examId, studentId: req.user.id }).lean();
          if (submission && submission.assignedQuestions && submission.assignedQuestions.length > 0) {
            assignedQuestionIds = submission.assignedQuestions;
          }
        }
      }
    }

    // Fetch full question data WITHOUT correctAnswer or modelAnswer
    const questions = await Question.find(
      { _id: { $in: assignedQuestionIds } },
      { correctAnswer: 0, modelAnswer: 0 }
    ).sort({ order: 1 }).lean();

    res.json({ questions, examType: exam.examType });
  } catch (error) {
    console.error('Error fetching questions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/exams/:examId/submit
 * Student submits answers. MCQ: auto-score by correct answer. Practical: auto-score by submission (non-empty = full marks).
 */
router.post('/:examId/submit', auth, async (req, res) => {
  try {
    const { answers, language } = req.body;
    const studentId = req.user.id;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' });
    }

    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Check existing submission — prevent duplicate submissions
    const existing = await Submission.findOne({ examId: req.params.examId, studentId });
    if (existing && existing.answers && existing.answers.length > 0) {
      return res.status(400).json({ message: 'You have already submitted this exam' });
    }

    // Fetch all questions referenced in the answers
    const questionIds = answers.map(a => a.questionId);
    const questions = await Question.find({ _id: { $in: questionIds } });

    let score = 0;
    let totalMarks = 0;

    for (const ans of answers) {
      const question = questions.find(q => q._id.toString() === ans.questionId);
      if (question) {
        totalMarks += question.marks;
        if (exam.examType === 'mcq') {
          if (ans.answer === question.correctAnswer) {
            score += question.marks;
          }
        } else if (exam.evaluationMethod !== 'ai') {
          // Manual practical: non-empty answer = full marks
          if (ans.answer && ans.answer.trim().length > 0) {
            score += question.marks;
          }
        }
        // For AI practical exams, score stays 0 until AI evaluation runs
      }
    }

    // Determine status and AI evaluation
    let status = 'submitted';
    let evaluationData = {};

    // Trigger AI evaluation for practical exams with ai evaluation method
    if (exam.examType === 'practical' && exam.evaluationMethod === 'ai') {
      try {
        const { evaluateSubmission } = require('../services/aiEvaluation');
        const lang = language || 'python';

        const evalResult = await evaluateSubmission({
          questions,
          answers,
          language: lang,
          strictness: exam.evaluationStrictness || 'medium',
        });

        evaluationData = {
          submittedCode: evalResult.submittedCode,
          generatedSolution: evalResult.generatedSolution,
          expectedOutput: evalResult.expectedOutput,
          studentOutput: evalResult.studentOutput,
          correctnessScore: evalResult.correctnessScore,
          qualityScore: evalResult.qualityScore,
          finalMarks: evalResult.finalMarks,
          totalMarks: evalResult.totalMarks,
          executionTime: evalResult.executionTime,
          memoryUsed: evalResult.memoryUsed,
          aiFeedback: evalResult.aiFeedback,
          evaluationMethod: 'ai',
          evaluationStrictness: exam.evaluationStrictness || 'medium',
        };

        score = evalResult.finalMarks;
        totalMarks = evalResult.totalMarks;
        status = 'evaluated';
        console.log(`[AI-EVAL] Student ${studentId} exam ${exam._id}: score=${score}/${totalMarks}, correctness=${evalResult.correctnessScore}%, quality=${evalResult.qualityScore}%`);
      } catch (evalErr) {
        console.error('[AI-EVAL] Evaluation failed:', evalErr.message);
        console.error('[AI-EVAL] Stack:', evalErr.stack);
        status = 'pending_review';
        evaluationData = {
          evaluationMethod: 'ai',
          evaluationStrictness: exam.evaluationStrictness || 'medium',
          aiFeedback: `AI evaluation failed: ${evalErr.message}. This submission requires manual review.`,
        };
      }
    }

    // Update existing preliminary submission or create new submission
    let savedSubmission;
    if (existing) {
      existing.answers = answers;
      existing.score = score;
      existing.totalMarks = totalMarks;
      existing.submittedAt = new Date();
      existing.status = status;
      Object.assign(existing, evaluationData);
      await existing.save();
      savedSubmission = existing;
    } else {
      const submission = new Submission({
        examId: req.params.examId,
        studentId,
        answers,
        score,
        totalMarks,
        submittedAt: new Date(),
        status,
        ...evaluationData
      });
      await submission.save();
      savedSubmission = submission;
    }

    // Build response — students should NOT see hidden evaluation data
    const responseSubmission = {
      score: savedSubmission.score,
      totalMarks: savedSubmission.totalMarks,
      submittedAt: savedSubmission.submittedAt,
      status: savedSubmission.status,
    };

    // Students only see limited data for AI-evaluated practical exams
    if (exam.examType === 'practical' && exam.evaluationMethod === 'ai') {
      responseSubmission.correctnessScore = savedSubmission.correctnessScore || 0;
      responseSubmission.qualityScore = savedSubmission.qualityScore || 0;
      responseSubmission.executionTime = savedSubmission.executionTime || 0;
      responseSubmission.memoryUsed = savedSubmission.memoryUsed || '';
      responseSubmission.aiFeedback = savedSubmission.aiFeedback || '';
      responseSubmission.passed = savedSubmission.totalMarks > 0 && (savedSubmission.score / savedSubmission.totalMarks) >= 0.5;
    }

    res.status(existing ? 200 : 201).json({ message: 'Exam submitted successfully', submission: responseSubmission });
  } catch (error) {
    console.error('Error submitting exam:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/exams/:examId/submit-file
 * Student uploads answer file for practical exams
 */
router.post('/:examId/submit-file', auth, upload.single('answerFile'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    let submission = await Submission.findOne({ examId: req.params.examId, studentId: req.user.id });
    if (submission && submission.answerFile) {
      return res.status(400).json({ message: 'You have already submitted a file for this exam' });
    }

    const filePath = '/uploads/answers/' + req.file.filename;

    if (submission) {
      submission.answerFile = filePath;
      submission.submittedAt = new Date();
      await submission.save();
    } else {
      submission = new Submission({
        examId: req.params.examId,
        studentId: req.user.id,
        answerFile: filePath,
        totalMarks: exam.totalMarks,
        submittedAt: new Date()
      });
      await submission.save();
    }

    res.status(200).json({ message: 'File uploaded successfully', filePath });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/exams/:examId/submission
 * Student views their submission — ONLY if resultDate has passed
 */
router.get('/:examId/submission', auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const submission = await Submission.findOne({
      examId: req.params.examId,
      studentId: req.user.id
    });

    // If no resultDate set yet, or resultDate hasn't passed → don't show score
    if (!submission) {
      return res.json({ submission: null });
    }

    const now = new Date();
    const resultPublished = exam.resultDate && now >= new Date(exam.resultDate);

    if (resultPublished) {
      const resultObj = submission.toObject();

      if (exam.examType === 'mcq' && resultObj.answers && resultObj.answers.length > 0) {
        const questionIds = resultObj.answers.map(a => a.questionId);
        const questions = await Question.find({ _id: { $in: questionIds } });
        const qMap = {};
        questions.forEach(q => { qMap[q._id.toString()] = q; });
        resultObj.answers = resultObj.answers.map(a => {
          const q = qMap[a.questionId?.toString()];
          const studentAns = (a.answer || '').trim().toLowerCase();
          const correctAns = (q ? q.correctAnswer : '').trim().toLowerCase();
          return {
            ...a,
            questionText: q ? q.questionText : 'Question deleted',
            correctAnswer: q ? q.correctAnswer : '',
            options: q ? q.options : [],
            marks: q ? q.marks : 0,
            isCorrect: q ? (studentAns === correctAns && studentAns !== '') : false
          };
        });
      }

      if (exam.examType === 'practical' && resultObj.evaluationMethod === 'ai') {
        delete resultObj.generatedSolution;
        delete resultObj.submittedCode;
      }

      if (exam.examType === 'practical' && resultObj.answers && resultObj.answers.length > 0) {
        const questionIds = resultObj.answers.map(a => a.questionId);
        const questions = await Question.find({ _id: { $in: questionIds } });
        const qMap = {};
        questions.forEach(q => { qMap[q._id.toString()] = q; });
        resultObj.answers = resultObj.answers.map(a => {
          const q = qMap[a.questionId?.toString()];
          return { ...a, questionText: q ? q.questionText : 'Question deleted', marks: q ? q.marks : 0 };
        });
      }

      res.json({ submission: resultObj, resultPublished: true });
    } else {
      // Only show that submission exists, hide score
      res.json({
        submission: {
          _id: submission._id,
          submittedAt: submission.submittedAt,
          status: submission.status,
          answerFile: submission.answerFile
        },
        resultPublished: false
      });
    }
  } catch (error) {
    console.error('Error fetching submission:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// CODE EXECUTION ENDPOINT
// POST /api/exams/run-code
// Executes code using Piston API (safe, sandboxed, 50+ languages)
// ============================================================

function buildPreviewHTML(code, language) {
  const lang = (language || '').toLowerCase();
  if (lang === 'html' || lang === 'svg') {
    return code;
  }
  if (lang === 'css' || lang === 'scss' || lang === 'sass' || lang === 'less') {
    return `<!DOCTYPE html>
<html><head><style>${code}</style></head>
<body>
  <h1>CSS Preview</h1>
  <p class="sample">This is a sample paragraph.</p>
  <div class="sample">This is a sample div.</div>
  <a href="#" class="sample">This is a sample link.</a>
  <ul class="sample"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>
  <button class="sample">Sample Button</button>
</body></html>`;
  }
  if (lang === 'markdown') {
    let html = code
      .replace(/^### (.*)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^- (.*)$/gm, '<li>$1</li>');
    return `<!DOCTYPE html><html><head><style>
      body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
      code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
      li { margin-left: 20px; }
    </style></head><body>${html}</body></html>`;
  }
  // JSX/TSX — render via React CDN in an iframe
  if (lang === 'jsx' || lang === 'tsx' || lang === 'react') {
    return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>body{font-family:sans-serif;padding:20px;margin:0} .error{color:red;background:#fff0f0;padding:12px;border-radius:8px;border:1px solid #ffcdd2}</style>
</head><body>
  <div id="root"></div>
  <script type="text/babel">
    try {
      ${code}
      // Try to find default export or first component
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App || (() => React.createElement('div', null, 'Component rendered but no default export found'))));
    } catch(e) {
      document.getElementById('root').innerHTML = '<div class="error"><b>Render Error:</b> ' + e.message + '</div>';
    }
  </script>
</body></html>`;
  }
  return `<pre>${code}</pre>`;
}

// Languages that produce no stdout — previewed in browser instead
const PREVIEW_LANGUAGES = new Set([
  'html', 'css', 'scss', 'sass', 'less', 'markdown', 'svg',
  'jsx', 'tsx', 'react', 'vue', 'svelte',
]);

// Languages that cannot be executed via Piston at all
const NON_EXECUTABLE_LANGUAGES = new Set([
  'jsx', 'tsx', 'react', 'vue', 'svelte',
  'html', 'css', 'scss', 'sass', 'less',
  'svg', 'markdown', 'xml',
]);

function isPreviewLanguage(lang) {
  return PREVIEW_LANGUAGES.has((lang || '').toLowerCase());
}

function isNonExecLanguage(lang) {
  return NON_EXECUTABLE_LANGUAGES.has((lang || '').toLowerCase());
}

router.post('/run-code', auth, async (req, res) => {
  try {
    const { code, language, stdin } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Code is required' });
    }
    if (!language) {
      return res.status(400).json({ message: 'Language is required' });
    }

    // Preview languages (HTML/CSS/JSX/TSX/etc.) → return HTML for browser rendering
    if (isPreviewLanguage(language)) {
      const previewHTML = buildPreviewHTML(code, language);
      return res.json({
        stdout: '',
        stderr: '',
        language,
        version: '',
        compile_output: '',
        status: 'preview',
        previewHTML,
      });
    }

    // Non-executable languages that aren't previewable → return code analysis
    if (isNonExecLanguage(language)) {
      return res.json({
        stdout: '',
        stderr: '',
        language,
        version: '',
        compile_output: '',
        status: 'not_executable',
        message: `Language "${language}" cannot be executed directly. Code analysis: ${code.split('\n').filter(l => l.trim()).length} lines, ${code.length} characters.`,
      });
    }

    const result = await executeCode(code, language, stdin || '');

    res.json({
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      language: result.language || language,
      version: result.version || '',
      compile_output: result.compileOutput || '',
      status: result.exitCode === 0 ? 'success' : 'error',
    });
  } catch (error) {
    console.error('Error running code:', error.message);
    res.status(500).json({ message: error.message || 'Code execution failed' });
  }
});

// ============================================================
// GET AVAILABLE LANGUAGES
// GET /api/exams/languages
// ============================================================
router.get('/languages', auth, (req, res) => {
  const languages = Object.entries(PISTON_LANGUAGES).map(([key, value]) => ({
    id: value,
    name: key.charAt(0).toUpperCase() + key.slice(1),
  }));
  const seen = new Set();
  const unique = languages.filter(l => {
    if (seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });
  res.json({ languages: unique });
});

module.exports = router;
