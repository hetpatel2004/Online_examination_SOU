const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },

  questionText: {
    type: String,
    required: true,
    trim: true
  },

  questionType: {
    type: String,
    enum: ['mcq', 'practical'],
    required: true
  },

  options: {
    type: [String],
    validate: {
      validator: function (v) {
        if (this.questionType === 'mcq') return v && v.length >= 2;
        return true;
      },
      message: 'MCQ questions need at least 2 options'
    }
  },

  correctAnswer: {
    type: String,
    required: function () {
      return this.questionType === 'mcq';
    }
  },

  marks: {
    type: Number,
    default: 1,
    min: 1
  },

  order: {
    type: Number,
    default: 0
  },

  modelAnswer: {
    type: String,
    default: ''
  },

  testCases: {
    type: [testCaseSchema],
    default: []
  }
}, { timestamps: true });

questionSchema.index({ examId: 1 });
questionSchema.index({ examId: 1, order: 1 });

module.exports = mongoose.model('Question', questionSchema);
