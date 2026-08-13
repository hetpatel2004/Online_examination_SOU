/**
 * Exam Model - Database Schema for storing scheduled exam information
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * Defines the structure of exam documents in MongoDB.
 * Each exam is scheduled by admin for a specific subject, semester, and course.
 * 
 * HOW EXAM SCHEDULING WORKS:
 * ==========================
 * 1. Admin creates an exam by selecting:
 *    - Subject (from existing subjects)
 *    - Date (when the exam will happen)
 *    - Time (start time of the exam)
 *    - Duration (how long the exam lasts, in minutes)
 *    - Semester (which semester's students can see this)
 *    - Course (which course's students can see this)
 * 
 * 2. The exam is saved in the database
 * 
 * 3. When a student views "My Exams":
 *    - Frontend calls GET /api/exams?semester={sem}&course={course}
 *    - Backend filters by BOTH semester AND course
 *    - Student ONLY sees exams matching their semester AND course
 *    - Example: MCA Sem 3 student sees only MCA Sem 3 exams
 * 
 * 4. Each exam shows:
 *    - Which subject it's for
 *    - When it's scheduled (date + time)
 *    - How long it lasts (duration)
 *    - Status: upcoming (future date) or completed (past date)
 * 
 * RELATIONSHIP WITH SUBJECTS:
 * ===========================
 * - Each exam is linked to a subject via subjectId (reference)
 * - The subject must exist in the Subject collection
 * - When creating an exam, admin selects from existing subjects
 */

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  // Reference to the Subject this exam is for
  // This links to the Subject model using MongoDB's ObjectId reference
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',  // References the 'Subject' model
    required: true
  },

  // Display name of the subject (denormalized for quick display)
  // Copied from Subject.name when exam is created
  subjectName: {
    type: String,
    required: true
  },

  // Subject code (e.g., "MCA401") - copied from Subject for quick display
  subjectCode: {
    type: String,
    required: true
  },

  // Date of the exam (YYYY-MM-DD format)
  // Example: "2026-08-15"
  date: {
    type: String,
    required: true
  },

  // Start time of the exam (HH:MM format, 24-hour)
  // Example: "10:00" for 10:00 AM, "14:30" for 2:30 PM
  time: {
    type: String,
    required: true
  },

  // Duration of the exam in minutes
  // Example: 60 = 1 hour, 120 = 2 hours, 30 = 30 minutes
  duration: {
    type: Number,
    required: true,
    min: 15,    // Minimum 15 minutes
    max: 300    // Maximum 5 hours (300 minutes)
  },

  // Which semester this exam is for
  // Controls which students can see this exam
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },

  // Which course this exam is for (MCA, BCA, etc.)
  // Controls which students can see this exam
  course: {
    type: String,
    required: true,
    trim: true
  },

  // Total marks for the exam (optional)
  totalMarks: {
    type: Number,
    default: 100
  },

  // Number of questions in the exam (total pool)
  totalQuestions: {
    type: Number,
    default: 0
  },

  // How many random questions each student gets from the pool
  questionsPerStudent: {
    type: Number,
    default: 0
  },

  // Type of exam: 'mcq' (multiple choice) or 'practical' (text answers)
  // Admin chooses when scheduling the exam
  examType: {
    type: String,
    enum: ['mcq', 'practical'],
    default: 'mcq'
  },

  // When results will be published to students (datetime)
  // Students cannot see scores before this datetime
  resultDate: {
    type: String,
    default: null
  },

  // Evaluation method for practical exams only
  // 'manual' = admin grades submissions manually
  // 'ai' = automatic AI-based code evaluation
  evaluationMethod: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual'
  },

  // Evaluation strictness for AI-based evaluation (only when evaluationMethod = 'ai')
  // Controls how strictly the AI evaluates code quality
  evaluationStrictness: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  }
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// Indexes for the two hot queries: student exam list (semester+course+date) and
// admin exam list (subjectId). Sorted scans are avoided entirely.
examSchema.index({ semester: 1, course: 1, date: 1, time: 1 });
examSchema.index({ subjectId: 1, semester: 1 });
examSchema.index({ date: 1, time: 1 });

module.exports = mongoose.model('Exam', examSchema);
