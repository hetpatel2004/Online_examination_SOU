/**
 * Admin Routes - Admin-only API endpoints for managing students and subjects
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * Provides API endpoints that only admin users can access.
 * Every route is protected by TWO layers of security:
 * 1. auth middleware → verifies JWT token (user must be logged in)
 * 2. role check → ensures req.user.role === 'admin'
 * 
 * AVAILABLE ROUTES:
 * ================
 * STUDENT MANAGEMENT:
 * GET    /api/admin/users          → Fetch all registered users
 * POST   /api/admin/users          → Create a new student (admin can add students)
 * PUT    /api/admin/users/:id      → Update student data (name, email, etc.)
 * DELETE /api/admin/users/:id      → Delete a student from the system
 * 
 * SUBJECT MANAGEMENT:
 * GET    /api/admin/subjects       → Fetch all subjects (with optional semester filter)
 * POST   /api/admin/subjects       → Create a new subject
 * PUT    /api/admin/subjects/:id   → Update subject data
 * DELETE /api/admin/subjects/:id   → Delete a subject
 * 
 * HOW ROLE PROTECTION WORKS:
 * ==========================
 * 1. Request comes in with JWT token in Authorization header
 * 2. auth middleware verifies token and attaches user to req.user
 * 3. Each route checks req.user.role === 'admin'
 * 4. If not admin → returns 403 Forbidden
 * 5. If admin → proceeds with database operations
 * 
 * ENROLLMENT UNIQUENESS:
 * ======================
 * - When creating a student, we check if enrollmentNumber already exists
 * - MongoDB also has a unique index on enrollmentNumber field
 * - Both checks prevent duplicate registrations
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const auth = require('../middleware/auth');

const router = express.Router();

// Multer config for practical answer ZIP uploads
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
  fileFilter: (req, file, cb) => {
    const allowed = /zip|rar|7z|pdf|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || file.mimetype === 'application/pdf';
    cb(null, ext || mime);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ============================================================
// ADMIN CHECK MIDDLEWARE
// Reusable middleware that checks if logged-in user is admin
// Used on every route in this file
// ============================================================
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

// Helper: verify the logged-in admin owns the subject for an exam
async function verifyExamOwnership(examId, adminId) {
  const Exam = require('../models/Exam');
  const Subject = require('../models/Subject');
  const exam = await Exam.findById(examId);
  if (!exam) return { error: 'Exam not found', status: 404 };
  const subject = await Subject.findById(exam.subjectId);
  if (!subject) return { error: 'Subject not found', status: 404 };
  // assignedTo is now an array — check if admin is in it
  const assigned = Array.isArray(subject.assignedTo) ? subject.assignedTo : (subject.assignedTo ? [subject.assignedTo] : []);
  if (assigned.length > 0 && !assigned.some(id => id.toString() === adminId)) {
    return { error: 'Access denied. This exam belongs to another faculty.', status: 403 };
  }
  return { exam, subject };
}

// ============================================================
// STUDENT MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/users
 * 
 * Purpose: Fetch all registered users (students + admins)
 * 
 * What happens:
 * 1. auth middleware verifies JWT token
 * 2. adminOnly middleware checks role is 'admin'
 * 3. Fetches all users from database (excludes passwords for security)
 * 4. Returns user list sorted by newest first
 * 
 * Query params (optional):
 * - ?role=user → only students
 * - ?role=admin → only admins
 * 
 * Response: { users: [{ name, enrollmentNumber, email, ... }, ...] }
 */
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    // Build filter object based on query params
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }

    // Fetch users, exclude password field, sort by newest first
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/users
 * 
 * Purpose: Admin can manually create a new student account
 * 
 * What happens:
 * 1. Receives student data from admin form
 * 2. Validates all required fields are provided
 * 3. Checks if enrollment number already exists (prevents duplicates)
 * 4. Checks if email already exists (prevents duplicates)
 * 5. Hashes the password using bcrypt
 * 6. Saves new student to database
 * 7. Returns the created student data (without password)
 * 
 * Body: { name, enrollmentNumber, email, phone, course, semester, aadharNumber, password }
 * Response: { user: { name, enrollmentNumber, ... } }
 */
router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, enrollmentNumber, email, phone, course, semester, aadharNumber, password } = req.body;

    // Validate required fields
    if (!name || !enrollmentNumber || !email || !phone || !course || !semester || !aadharNumber || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if enrollment number already exists (prevent duplicate students)
    const existingEnrollment = await User.findOne({ enrollmentNumber });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Enrollment number already exists' });
    }

    // Check if email already exists (prevent duplicate emails)
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Determine role based on enrollment pattern (same logic as registration)
    const role = enrollmentNumber.toUpperCase().startsWith('ADMIN') ? 'admin' : 'user';

    // Hash the password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save new user
    const newUser = new User({
      name,
      enrollmentNumber,
      email,
      phone,
      course,
      semester,
      aadharNumber,
      password: hashedPassword,
      role
    });

    await newUser.save();

    // Return user data without password
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({ user: userResponse });
  } catch (error) {
    console.error('Error creating user:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * 
 * Purpose: Update an existing student's information
 * 
 * What happens:
 * 1. Receives updated data + student ID from URL params
 * 2. Finds the student in database by ID
 * 3. Updates only the provided fields (name, email, phone, etc.)
 * 4. If password is provided, hashes it before saving
 * 5. Saves the updated student
 * 6. Returns the updated student data
 * 
 * URL: /api/admin/users/64f5a1b2c3d4e5f6a7b8c9d0
 * Body: { name: "New Name", email: "new@email.com", ... }
 * Response: { user: { name: "New Name", email: "new@email.com", ... } }
 */
router.put('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, course, semester, password } = req.body;

    // Find student by ID
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update only provided fields (don't overwrite with undefined)
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (course) user.course = course;
    if (semester) user.semester = semester;

    // Only hash and update password if a new one is provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Return updated user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * 
 * Purpose: Delete a student from the system
 * 
 * What happens:
 * 1. Receives student ID from URL params
 * 2. Finds and deletes the student from database
 * 3. Returns success message
 * 
 * URL: /api/admin/users/64f5a1b2c3d4e5f6a7b8c9d0
 * Response: { message: 'User deleted successfully' }
 */
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// SUBJECT MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/admin/subjects
 * Read-only: Admin can only see subjects assigned to them
 */
router.get('/subjects', auth, adminOnly, async (req, res) => {
  try {
    const filter = { assignedTo: req.user.id };
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.course) filter.course = req.query.course;

    const subjects = await Subject.find(filter).sort({ semester: 1, code: 1 });
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// EXAM MANAGEMENT ROUTES
// Admin can schedule exams with date, time, subject, semester, course
// ============================================================

/**
 * GET /api/admin/exams
 * 
 * Purpose: Fetch all scheduled exams (admin can see all)
 * 
 * Query params (optional):
 * - ?semester=3 → filter by semester
 * - ?course=MCA → filter by course
 * 
 * Response: { exams: [{ subjectName, date, time, duration, ... }, ...] }
 */
router.get('/exams', auth, adminOnly, async (req, res) => {
  try {
    // Find subjects assigned to this admin
    const mySubjects = await Subject.find({ assignedTo: req.user.id }).select('_id');
    const mySubjectIds = mySubjects.map(s => s._id);

    // Only show exams for assigned subjects
    const filter = { subjectId: { $in: mySubjectIds } };
    if (req.query.semester) filter.semester = Number(req.query.semester);
    if (req.query.course) filter.course = req.query.course;

    const exams = await Exam.find(filter).sort({ date: 1, time: 1 });
    res.json({ exams });
  } catch (error) {
    console.error('Error fetching exams:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/exams
 * 
 * Purpose: Schedule a new exam
 * 
 * Body: { subjectId, date, time, duration, semester, course, totalMarks, totalQuestions }
 * 
 * What happens:
 * 1. Validates all required fields
 * 2. Looks up the subject to get its name and code
 * 3. Creates exam record with subject details
 * 4. Returns the created exam
 */
router.post('/exams', auth, adminOnly, async (req, res) => {
  try {
    const { subjectId, date, time, duration, semester, course, totalMarks, totalQuestions, examType, questionsPerStudent, resultDate, evaluationMethod, evaluationStrictness } = req.body;

    if (!subjectId || !date || !time || !duration || !semester || !course) {
      return res.status(400).json({ message: 'Subject, date, time, duration, semester, and course are required' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Only allow creating exams for subjects assigned to this admin
    const assigned = Array.isArray(subject.assignedTo) ? subject.assignedTo : (subject.assignedTo ? [subject.assignedTo] : []);
    if (assigned.length > 0 && !assigned.some(id => id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'You can only create exams for your assigned subjects' });
    }

    const newExam = new Exam({
      subjectId,
      subjectName: subject.name,
      subjectCode: subject.code,
      date,
      time,
      duration: Number(duration),
      semester: Number(semester),
      course,
      totalMarks: totalMarks || 100,
      totalQuestions: totalQuestions || 0,
      examType: examType || 'mcq',
      questionsPerStudent: Number(questionsPerStudent) || 0,
      resultDate: resultDate || null,
      evaluationMethod: examType === 'practical' ? (evaluationMethod || 'manual') : 'manual',
      evaluationStrictness: examType === 'practical' && evaluationMethod === 'ai' ? (evaluationStrictness || 'medium') : 'medium'
    });

    await newExam.save();
    res.status(201).json({ exam: newExam });
  } catch (error) {
    console.error('Error creating exam:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/exams/:id
 * 
 * Purpose: Update a scheduled exam
 * 
 * URL: /api/admin/exams/64f5a1b2c3d4e5f6a7b8c9d0
 * Body: { date: "2026-09-01", time: "11:00", ... }
 */
router.put('/exams/:id', auth, adminOnly, async (req, res) => {
  try {
    const { subjectId, date, time, duration, semester, course, totalMarks, totalQuestions, examType, questionsPerStudent, resultDate, evaluationMethod, evaluationStrictness } = req.body;

    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Verify this exam belongs to a subject assigned to this admin
    const examSubject = await Subject.findById(exam.subjectId);
    if (examSubject) {
      const assigned = Array.isArray(examSubject.assignedTo) ? examSubject.assignedTo : (examSubject.assignedTo ? [examSubject.assignedTo] : []);
      if (assigned.length > 0 && !assigned.some(id => id.toString() === req.user.id)) {
        return res.status(403).json({ message: 'You can only edit exams for your assigned subjects' });
      }
    }

    if (subjectId && subjectId !== exam.subjectId.toString()) {
      const subject = await Subject.findById(subjectId);
      if (!subject) {
        return res.status(404).json({ message: 'Subject not found' });
      }
      exam.subjectId = subjectId;
      exam.subjectName = subject.name;
      exam.subjectCode = subject.code;
    }

    if (date) exam.date = date;
    if (time) exam.time = time;
    if (duration) exam.duration = Number(duration);
    if (semester) exam.semester = Number(semester);
    if (course) exam.course = course;
    if (totalMarks !== undefined) exam.totalMarks = totalMarks;
    if (totalQuestions !== undefined) exam.totalQuestions = totalQuestions;
    if (examType) exam.examType = examType;
    const oldQuestionsPerStudent = exam.questionsPerStudent;
    if (questionsPerStudent !== undefined) exam.questionsPerStudent = Number(questionsPerStudent);
    if (resultDate !== undefined) exam.resultDate = resultDate || null;
    if (evaluationMethod !== undefined) exam.evaluationMethod = evaluationMethod || 'manual';
    if (evaluationStrictness !== undefined) exam.evaluationStrictness = evaluationStrictness || 'medium';

    await exam.save();

    // If questionsPerStudent changed, delete all existing submissions so students retake with the correct count
    if (questionsPerStudent !== undefined && Number(questionsPerStudent) !== oldQuestionsPerStudent) {
      const Submission = require('../models/Submission');
      const result = await Submission.deleteMany({ examId: exam._id });
      console.log(`[ADMIN] questionsPerStudent changed from ${oldQuestionsPerStudent} to ${Number(questionsPerStudent)} for exam ${exam._id}. Deleted ${result.deletedCount} submissions.`);
    }

    res.json({ exam });
  } catch (error) {
    console.error('Error updating exam:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/admin/exams/:id
 * 
 * Purpose: Delete a scheduled exam
 */
router.delete('/exams/:id', auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Verify ownership
    const examSubject = await Subject.findById(exam.subjectId);
    if (examSubject) {
      const assigned = Array.isArray(examSubject.assignedTo) ? examSubject.assignedTo : (examSubject.assignedTo ? [examSubject.assignedTo] : []);
      if (assigned.length > 0 && !assigned.some(id => id.toString() === req.user.id)) {
        return res.status(403).json({ message: 'You can only delete exams for your assigned subjects' });
      }
    }

    await Exam.findByIdAndDelete(req.params.id);
    await Question.deleteMany({ examId: req.params.id });
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// QUESTION MANAGEMENT ROUTES
// Admin can add/edit/delete questions for an exam
// ============================================================

/**
 * GET /api/admin/exams/:examId/questions
 * Fetch all questions for a specific exam
 */
router.get('/exams/:examId/questions', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const questions = await Question.find({ examId: req.params.examId }).sort({ order: 1, createdAt: 1 });
    res.json({ questions });
  } catch (error) {
    console.error('Error fetching questions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/admin/exams/:examId/questions
 * Add a question to an exam
 */
router.post('/exams/:examId/questions', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const { questionText, questionType, options, correctAnswer, marks } = req.body;

    if (!questionText || !questionType) {
      return res.status(400).json({ message: 'Question text and type are required' });
    }

    if (questionType === 'mcq' && (!options || options.length < 2 || !correctAnswer)) {
      return res.status(400).json({ message: 'MCQ questions need at least 2 options and a correct answer' });
    }

    // Get the next order number
    const lastQuestion = await Question.findOne({ examId: req.params.examId }).sort({ order: -1 });
    const order = lastQuestion ? lastQuestion.order + 1 : 1;

    const question = new Question({
      examId: req.params.examId,
      questionText,
      questionType,
      options: questionType === 'mcq' ? options : [],
      correctAnswer: questionType === 'mcq' ? correctAnswer : '',
      marks: marks || 1,
      order
    });

    await question.save();

    // Update exam totalQuestions count
    const count = await Question.countDocuments({ examId: req.params.examId });
    await Exam.findByIdAndUpdate(req.params.examId, { totalQuestions: count });

    res.status(201).json({ question });
  } catch (error) {
    console.error('Error creating question:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * PUT /api/admin/exams/:examId/questions/:questionId
 * Update a question
 */
router.put('/exams/:examId/questions/:questionId', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const { questionText, questionType, options, correctAnswer, marks } = req.body;

    const question = await Question.findById(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (questionText) question.questionText = questionText;
    if (questionType) question.questionType = questionType;
    if (options) question.options = options;
    if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
    if (marks) question.marks = marks;

    await question.save();
    res.json({ question });
  } catch (error) {
    console.error('Error updating question:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * DELETE /api/admin/exams/:examId/questions/:questionId
 * Delete a question
 */
router.delete('/exams/:examId/questions/:questionId', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const question = await Question.findByIdAndDelete(req.params.questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Update exam totalQuestions count
    const count = await Question.countDocuments({ examId: req.params.examId });
    await Exam.findByIdAndUpdate(req.params.examId, { totalQuestions: count });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// BULK UPLOAD QUESTIONS
// POST /api/admin/exams/:examId/questions/bulk
// Accepts JSON array of questions OR CSV text
//
// CSV formats supported (with or without header row):
//
// MCQ:
//   questionText,optionA,optionB,optionC,optionD,correctAnswer,marks
//   "What is HTML?","Language","Framework","Database","OS","Language",1
//
// Practical:
//   questionText,marks
//   "Write a program to reverse a string",10
//
// If header row is present and contains "question", it is skipped.
// If no header is detected, row 1 is treated as data.
// ============================================================
router.post('/exams/:examId/questions/bulk', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    let questionsData = [];

    // ---- CSV text parsing ----
    if (req.body.csvText && typeof req.body.csvText === 'string' && req.body.csvText.trim()) {
      const raw = req.body.csvText.trim();
      const lines = raw.split(/\r?\n/).filter(l => l.trim());

      if (lines.length === 0) {
        return res.status(400).json({ message: 'CSV is empty' });
      }

      // Detect if first line is a header
      const firstLineLower = lines[0].toLowerCase();
      const hasHeader = firstLineLower.includes('question') || firstLineLower.includes('option') || firstLineLower.includes('correct') || firstLineLower.includes('marks');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      for (let i = 0; i < dataLines.length; i++) {
        const cols = parseCSVLine(dataLines[i]);
        if (cols.length < 2) continue;

        if (exam.examType === 'mcq') {
          // MCQ format: question, optA, optB, [optC], [optD], correctAnswer, marks
          // Minimum: question, 2 options, correctAnswer, marks = 5 columns
          if (cols.length >= 5) {
            const marks = Number(cols[cols.length - 1]) || 1;
            const correctAnswer = cols[cols.length - 2] || '';
            const questionText = cols[0];
            const options = cols.slice(1, cols.length - 2).filter(Boolean);

            if (questionText && options.length >= 2 && correctAnswer) {
              questionsData.push({
                questionText,
                questionType: 'mcq',
                options,
                correctAnswer,
                marks
              });
            }
          }
        } else {
          // Practical: question, marks
          questionsData.push({
            questionText: cols[0],
            questionType: 'practical',
            options: [],
            correctAnswer: '',
            marks: Number(cols[1]) || 10
          });
        }
      }
    }

    // ---- JSON array parsing ----
    if (req.body.questions && Array.isArray(req.body.questions)) {
      questionsData = req.body.questions;
    }

    if (questionsData.length === 0) {
      const hint = exam.examType === 'mcq'
        ? 'MCQ CSV format: questionText,optionA,optionB,optionC,optionD,correctAnswer,marks'
        : 'Practical CSV format: questionText,marks';
      return res.status(400).json({ message: 'No valid questions found. ' + hint });
    }

    // Bulk insert
    const lastQuestion = await Question.findOne({ examId: req.params.examId }).sort({ order: -1 });
    let order = lastQuestion ? lastQuestion.order + 1 : 1;

    const questionsToInsert = questionsData.map((q) => ({
      examId: req.params.examId,
      questionText: q.questionText,
      questionType: q.questionType || exam.examType,
      options: q.options || [],
      correctAnswer: q.correctAnswer || '',
      marks: q.marks || 1,
      order: order++
    }));

    const inserted = await Question.insertMany(questionsToInsert, { ordered: false });

    // Update exam totalQuestions count
    const count = await Question.countDocuments({ examId: req.params.examId });
    await Exam.findByIdAndUpdate(req.params.examId, { totalQuestions: count });

    res.status(201).json({ message: `${inserted.length} questions uploaded successfully`, count: inserted.length });
  } catch (error) {
    console.error('Error bulk uploading questions:', error.message);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
});

/**
 * Parse a single CSV line, handling quoted fields with commas inside.
 * Example: "What is HTML, CSS?",A,B,C,D,A,1
 * Returns: ['What is HTML, CSS?', 'A', 'B', 'C', 'D', 'A', '1']
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ============================================================
// SET RESULT DATE
// PUT /api/admin/exams/:examId/result-date
// Admin sets when results will be published to students
// ============================================================
router.put('/exams/:examId/result-date', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const { resultDate } = req.body;
    const exam = await Exam.findByIdAndUpdate(
      req.params.examId,
      { resultDate: resultDate || null },
      { new: true }
    );
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json({ message: 'Result date updated', exam });
  } catch (error) {
    console.error('Error setting result date:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// GET ALL SUBMISSIONS FOR AN EXAM (Admin)
// GET /api/admin/exams/:examId/submissions
// Returns full submission data: student info, answers, score,
// question text with correct/incorrect status for MCQ
// ============================================================
router.get('/exams/:examId/submissions', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const Submission = require('../models/Submission');

    const submissions = await Submission.find({ examId: req.params.examId })
      .populate('studentId', 'name enrollmentNumber email phone course semester')
      .sort({ submittedAt: -1 });

    // For MCQ exams, enrich answers with question text + correct answer + isCorrect
    const exam = await Exam.findById(req.params.examId);
    const enriched = await Promise.all(submissions.map(async (sub) => {
      const obj = sub.toObject();

      if (exam && exam.examType === 'mcq' && obj.answers && obj.answers.length > 0) {
        const questionIds = obj.answers.map(a => a.questionId);
        const questions = await Question.find({ _id: { $in: questionIds } });
        const qMap = {};
        questions.forEach(q => { qMap[q._id.toString()] = q; });

        obj.answers = obj.answers.map(a => {
          const q = qMap[a.questionId?.toString()];
          const studentAns = (a.answer || '').trim().toLowerCase();
          const correctAns = (q ? q.correctAnswer : '').trim().toLowerCase();
          return {
            ...a,
            questionText: q ? q.questionText : 'Question deleted',
            correctAnswer: q ? q.correctAnswer : '',
            marks: q ? q.marks : 0,
            isCorrect: q ? (studentAns === correctAns && studentAns !== '') : false
          };
        });
      }

      if (exam && exam.examType === 'practical' && obj.answers && obj.answers.length > 0) {
        const questionIds = obj.answers.map(a => a.questionId);
        const questions = await Question.find({ _id: { $in: questionIds } });
        const qMap = {};
        questions.forEach(q => { qMap[q._id.toString()] = q; });

        obj.answers = obj.answers.map(a => {
          const q = qMap[a.questionId?.toString()];
          return {
            ...a,
            questionText: q ? q.questionText : 'Question deleted',
            marks: q ? q.marks : 0
          };
        });
      }

      return obj;
    }));

    res.json({ submissions: enriched, examType: exam ? exam.examType : null, totalMarks: exam ? exam.totalMarks : 0 });
  } catch (error) {
    console.error('Error fetching submissions:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// GRADE A SUBMISSION (Admin)
// PUT /api/admin/exams/:examId/submissions/:studentId/grade
// Admin assigns per-question marks + feedback for practical exams
// ============================================================
router.put('/exams/:examId/submissions/:studentId/grade', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const Submission = require('../models/Submission');
    const { questionScores, totalScore } = req.body;

    const submission = await Submission.findOne({
      examId: req.params.examId,
      studentId: req.params.studentId
    });

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    if (questionScores && Array.isArray(questionScores)) {
      submission.questionScores = questionScores;
    }

    // Calculate total from questionScores if provided, otherwise use totalScore
    if (questionScores && Array.isArray(questionScores)) {
      submission.score = questionScores.reduce((sum, qs) => sum + (Number(qs.score) || 0), 0);
    } else if (totalScore !== undefined) {
      submission.score = Number(totalScore) || 0;
    }

    submission.status = 'graded';
    await submission.save();

    res.json({ message: 'Grading saved successfully', submission });
  } catch (error) {
    console.error('Error grading submission:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// PLAGIARISM CHECK
// GET /api/admin/exams/:examId/plagiarism
// Compares all student code submissions for similarity
// ============================================================
router.get('/exams/:examId/plagiarism', auth, adminOnly, async (req, res) => {
  try {
    const check = await verifyExamOwnership(req.params.examId, req.user.id);
    if (check.error) return res.status(check.status).json({ message: check.error });

    const { generatePlagiarismReport } = require('../services/plagiarismService');
    const report = await generatePlagiarismReport(req.params.examId);
    res.json(report);
  } catch (error) {
    console.error('Error generating plagiarism report:', error.message);
    res.status(500).json({ message: 'Failed to generate plagiarism report' });
  }
});

module.exports = router;
