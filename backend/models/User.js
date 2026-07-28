/**
 * User Model - Database Schema for storing user information
 * 
 * This file defines the structure of user documents in MongoDB.
 * Each field represents a piece of information we collect during registration.
 * 
 * ROLES EXPLANATION:
 * ==================
 * We have 2 roles: 'admin' and 'user'
 * 
 * How role is assigned:
 * - If the enrollment number starts with "ADMIN" (e.g., "ADMIN001"), 
 *   the person is automatically assigned 'admin' role
 * - All other enrollment numbers get 'user' role
 * 
 * This means:
 * - No need for a dropdown on login page
 * - The system automatically checks the enrollment number pattern
 * - Admin credentials: Enrollment = "ADMIN001", Password = any 12-digit number
 * - User credentials: Enrollment = 13-digit number (e.g., 2504070200049), Password = Aadhar number
 * 
 * WHY THIS APPROACH:
 * - Simple and secure (no one can manually select admin role)
 * - Only people who know the admin enrollment pattern can login as admin
 * - Database stores the role so we know who is admin on every request
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Full name of the student/admin
  name: {
    type: String,
    required: true
  },
  
  // Enrollment number - unique identifier for each student
  // Format: 13 digits for students (e.g., 2504070200049)
  // Format: Starts with "ADMIN" for admin (e.g., ADMIN001)
  enrollmentNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // Email address - used for communication and unique identification
  email: {
    type: String,
    required: true,
    unique: true
  },
  
  // Phone number - 10 digits
  phone: {
    type: String,
    required: true
  },
  
  // Course name (MCA, B.Sc IT, M.Sc IT, etc.)
  course: {
    type: String,
    required: true
  },
  
  // Semester (1, 2, 3, 4)
  semester: {
    type: String,
    required: true
  },
  
  // Aadhar card number - used as password for students
  // For admin, this can be any 12-digit number
  aadharNumber: {
    type: String,
    required: true
  },
  
  // Hashed password - stored securely using bcrypt
  // This is the aadhar number but encrypted for security
  password: {
    type: String,
    required: true
  },
  
  /**
   * ROLE FIELD - Determines if person is admin or user
   * 
   * Values: 'user' or 'admin'
   * Default: 'user' (new registrations are always users)
   * 
   * Admin role is assigned automatically during registration:
   * - If enrollmentNumber starts with "ADMIN" → role = 'admin'
   * - Otherwise → role = 'user'
   * 
   * This role is sent to frontend during login
   * Frontend uses this to show different dashboards:
   * - Admin → Admin Dashboard (can manage exams, questions, students)
   * - User → Student Dashboard (can view exams, take tests, upload assignments)
   */
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  }
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

module.exports = mongoose.model('User', userSchema);
