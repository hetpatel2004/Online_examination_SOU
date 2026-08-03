/**
 * Authentication Routes - Handles user registration and login
 * 
 * This file contains all the API endpoints for authentication:
 * 1. POST /api/auth/register - Create new user account
 * 2. POST /api/auth/login - Login with credentials
 * 
 * ROLE DETECTION LOGIC (No dropdown needed!):
 * ============================================
 * The system automatically detects if a person is admin or user
 * based on their enrollment number pattern:
 * 
 * - If enrollment number starts with "ADMIN" → role = 'admin'
 * - All other enrollment numbers → role = 'user'
 * 
 * Example:
 * - "ADMIN001" with password "123456789012" → Admin login
 * - "2504070200049" with Aadhar as password → Student login
 * 
 * HOW LOGIN WORKS:
 * ================
 * 1. User enters enrollment number and password (Aadhar number)
 * 2. Backend looks up the user in database by enrollment number
 * 3. Compares the entered password with stored hashed password
 * 4. If match found, creates a JWT token with user ID and role
 * 5. Returns token + user data (including role) to frontend
 * 6. Frontend stores the role and routes to appropriate dashboard
 */

const express = require('express');
const bcrypt = require('bcryptjs');        // For hashing and comparing passwords
const jwt = require('jsonwebtoken');       // For creating authentication tokens
const User = require('../models/User');    // User model to interact with database

const router = express.Router();

/**
 * POST /api/auth/register
 * 
 * Purpose: Register a new student or admin
 * 
 * What happens:
 * 1. Receives form data from frontend (name, enrollment, email, etc.)
 * 2. Validates all fields are provided
 * 3. Checks if enrollment number or email already exists
 * 4. Determines role based on enrollment number pattern
 * 5. Hashes the password (aadhar number) using bcrypt
 * 6. Saves new user to MongoDB database
 * 7. Creates JWT token for automatic login after registration
 * 8. Returns token + user data to frontend
 */
router.post('/register', async (req, res) => {
  try {
    // Step 1: Extract all fields from the request body
    const { name, enrollmentNumber, email, phone, course, semester, aadharNumber } = req.body;

    // Step 2: Validate - make sure all required fields are provided
    if (!name || !enrollmentNumber || !email || !phone || !course || !semester || !aadharNumber) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Step 3: Validate enrollment number format
    // Students: must be exactly 13 digits (e.g., 2504070200049)
    // Admin: must start with "ADMIN" (e.g., ADMIN001, ADMIN002)
    const isAdminEnrollment = enrollmentNumber.toUpperCase().startsWith('ADMIN');
    if (!isAdminEnrollment && enrollmentNumber.length !== 13) {
      return res.status(400).json({ message: 'Enrollment number must be 13 digits (or start with ADMIN for admin)' });
    }

    // Step 4: Validate Aadhar number format (12 digits)
    if (aadharNumber.length !== 12) {
      return res.status(400).json({ message: 'Aadhar number must be 12 digits' });
    }

    // Step 5: Check if enrollment number already exists in database
    let user = await User.findOne({ enrollmentNumber });
    if (user) {
      return res.status(400).json({ message: 'Enrollment number already registered' });
    }

    // Step 6: Check if email already exists in database
    user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    /**
     * Step 7: DETERMINE ROLE BASED ON ENROLLMENT NUMBER
     * 
     * This is where the magic happens - no dropdown needed!
     * 
     * Logic:
     * - enrollmentNumber.toUpperCase() converts to uppercase for comparison
     * - .startsWith("ADMIN") checks if it begins with "ADMIN"
     * - If yes → role = 'admin'
     * - If no → role = 'user'
     * 
     * Example:
     * - "ADMIN001" → starts with "ADMIN" → role = 'admin'
     * - "2504070200049" → doesn't start with "ADMIN" → role = 'user'
     */
    const upperEnrollment = enrollmentNumber.toUpperCase();
    let role = 'user';
    if (upperEnrollment.startsWith('SUPER')) {
      return res.status(400).json({ message: 'Super Admin accounts cannot be registered manually' });
    } else if (upperEnrollment.startsWith('ADMIN')) {
      role = 'admin';
    }

    // Step 8: Hash the password using bcrypt
    // Salt rounds = 10 (higher = more secure but slower)
    // This converts "123456789012" into something like "$2a$10$xyz..."
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(aadharNumber, salt);

    // Step 9: Create new user object with all data
    user = new User({
      name,
      enrollmentNumber,
      email,
      phone,
      course,
      semester,
      aadharNumber,
      password: hashedPassword,  // Store hashed password, not plain text
      role  // 'admin' or 'user' based on enrollment number
    });

    // Step 10: Save user to MongoDB database
    await user.save();

    // Step 11: Create JWT (JSON Web Token) for authentication
    // This token proves the user is logged in
    // Contains user ID, expires in 7 days
    const token = jwt.sign(
      { userId: user._id },  // Payload - contains user ID
      process.env.JWT_SECRET,  // Secret key to sign the token
      { expiresIn: '7d' }  // Token expires after 7 days
    );

    // Step 12: Send response back to frontend
    // Frontend receives this data and stores it for later use
    res.status(201).json({
      token,  // JWT token for authentication
      user: {
        id: user._id,
        name: user.name,
        enrollmentNumber: user.enrollmentNumber,
        email: user.email,
        phone: user.phone,
        course: user.course,
        semester: user.semester,
        role: user.role  // 'admin' or 'user' - frontend uses this for routing
      }
    });
  } catch (error) {
    // If any error occurs, log it and send error response
    console.error('Register error:', error.message);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * 
 * Purpose: Login with enrollment number and password
 * 
 * What happens:
 * 1. Receives enrollment number and password from frontend
 * 2. Finds the user in database by enrollment number
 * 3. Compares entered password with stored hashed password
 * 4. If match → creates JWT token and returns user data with role
 * 5. If no match → returns error
 * 
 * ROLE AUTO-DETECTION DURING LOGIN:
 * ==================================
 * The role is already stored in the database from registration.
 * During login, we simply read the role from the database
 * and send it to the frontend.
 * 
 * Frontend then uses this role to:
 * - Redirect to /admin-dashboard if role = 'admin'
 * - Redirect to /dashboard if role = 'user'
 */
router.post('/login', async (req, res) => {
  try {
    // Step 1: Extract enrollment number and password from request
    const { enrollmentNumber, password } = req.body;

    // Step 2: Validate input
    if (!enrollmentNumber || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Step 3: Find user in database by enrollment number
    const user = await User.findOne({ enrollmentNumber });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Step 4: Compare entered password with stored hashed password
    // bcrypt.compare() handles the hashing comparison automatically
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Step 4.5: Reject blocked accounts
    if (user.isBlocked) {
      return res.status(403).json({ message: 'Your account has been blocked. Please contact the administrator.' });
    }

    // Step 5: Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    /**
     * Step 6: Send response with user data AND role
     * 
     * The role is crucial - frontend uses it to:
     * 1. Route to correct dashboard (admin or student)
     * 2. Show/hide certain menu items
     * 3. Control access to admin features
     * 
     * If role = 'admin':
     * - Frontend shows Admin Dashboard
     * - Can manage exams, questions, students
     * - Can view all submissions
     * 
     * If role = 'user':
     * - Frontend shows Student Dashboard
     * - Can view own subjects and exams
     * - Can take exams and upload assignments
     */
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        enrollmentNumber: user.enrollmentNumber,
        email: user.email,
        phone: user.phone,
        course: user.course,
        semester: user.semester,
        role: user.role  // THIS IS THE KEY FIELD - 'admin' or 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
