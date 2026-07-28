const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },

  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Which questions were randomly assigned to this student from the pool
  assignedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],

  // Array of answers
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    answer: {
      type: String,
      default: ''
    }
  }],

  // For practical exams: uploaded answer file path (ZIP)
  answerFile: {
    type: String,
    default: null
  },

  // Auto-calculated score for MCQ (correct/total)
  score: {
    type: Number,
    default: 0
  },

  // Per-question scores assigned by admin (for practical exams - manual grading)
  questionScores: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    score: {
      type: Number,
      default: 0
    },
    feedback: {
      type: String,
      default: ''
    }
  }],

  // Total marks possible
  totalMarks: {
    type: Number,
    default: 0
  },

  // When the student submitted
  submittedAt: {
    type: Date,
    default: Date.now
  },

  // Submission status
  // 'submitted' = awaiting grading
  // 'graded' = manually graded by admin
  // 'evaluated' = auto-evaluated by AI
  // 'pending_review' = AI evaluation failed, needs manual review
  status: {
    type: String,
    enum: ['submitted', 'graded', 'evaluated', 'pending_review'],
    default: 'submitted'
  },

  // ========== AI EVALUATION FIELDS ==========

  // Per-question submitted code with language info
  submittedCode: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    code: { type: String, default: '' },
    language: { type: String, default: '' }
  }],

  // AI-generated ideal solution per question
  generatedSolution: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    solution: { type: String, default: '' }
  }],

  // Expected output per question (from AI-generated solution execution)
  expectedOutput: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    output: { type: String, default: '' }
  }],

  // Student's actual output per question (from code execution)
  studentOutput: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    output: { type: String, default: '' },
    error: { type: String, default: '' }
  }],

  // Correctness score (0-100) based on output comparison
  correctnessScore: {
    type: Number,
    default: 0
  },

  // Code quality score (0-100) from AI review
  qualityScore: {
    type: Number,
    default: 0
  },

  // Final computed marks (correctness + quality combined)
  finalMarks: {
    type: Number,
    default: 0
  },

  // Which evaluation method was used for this submission
  evaluationMethod: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual'
  },

  // Which strictness level was used
  evaluationStrictness: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },

  // Total execution time in milliseconds
  executionTime: {
    type: Number,
    default: 0
  },

  // Peak memory usage string (e.g., "12.5 MB")
  memoryUsed: {
    type: String,
    default: ''
  },

  // AI-generated feedback (human-readable summary)
  aiFeedback: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// One submission per student per exam
submissionSchema.index({ examId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
