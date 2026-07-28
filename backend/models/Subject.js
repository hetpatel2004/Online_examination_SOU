/**
 * Subject Model - Database Schema for storing subject/course information
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * Defines the structure of subject documents in MongoDB.
 * Each subject belongs to a specific semester and course.
 * 
 * HOW SUBJECT-SEMESTER RELATIONSHIP WORKS:
 * ========================================
 * 1. Admin creates subjects with a semester number (1, 2, 3, or 4)
 * 2. Each subject is linked to a course (e.g., MCA)
 * 3. When a student logs in, their semester is known from their profile
 * 4. Frontend requests only subjects matching that semester
 * 5. Student sees ONLY their semester's subjects — not other semesters
 * 
 * EXAMPLE:
 * --------
 * Admin adds these subjects:
 * - "Advanced Web Technologies" (MCA401) → Semester 1, Course MCA
 * - "Artificial Intelligence" (MCA402) → Semester 1, Course MCA
 * - "Machine Learning" (MCA403) → Semester 2, Course MCA
 * 
 * A student in Semester 1, Course MCA sees: MCA401, MCA402
 * A student in Semester 2, Course MCA sees: MCA403
 */

const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  // Subject name (e.g., "Advanced Web Technologies")
  name: {
    type: String,
    required: true,
    trim: true
  },

  // Subject code (e.g., "MCA401") — unique identifier
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Which semester this subject belongs to (1, 2, 3, or 4)
  // This controls which students can see this subject
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },

  // Which course this subject belongs to (e.g., "MCA", "BCA")
  course: {
    type: String,
    required: true,
    trim: true
  },

  // Optional description about the subject
  description: {
    type: String,
    default: ''
  },

  // Faculty (admins) assigned to teach this subject — supports multiple admins
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

module.exports = mongoose.model('Subject', subjectSchema);
