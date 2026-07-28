const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  level: {
    type: String,
    enum: ['graduation', 'postgraduation'],
    default: 'postgraduation'
  },
  totalSemesters: {
    type: Number,
    default: 4,
    min: 1,
    max: 8
  }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);
