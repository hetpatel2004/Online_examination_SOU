/**
 * Subjects Routes - Public routes for fetching subjects
 * 
 * WHAT THIS FILE DOES:
 * ====================
 * Provides API endpoints for fetching subjects that ANY authenticated user can access.
 * This is separate from admin routes because students also need to see subjects.
 * 
 * WHY A SEPARATE FILE:
 * ====================
 * - /api/admin/subjects → Admin-only (CRUD: create, update, delete)
 * - /api/subjects → Any logged-in user can read subjects (no admin check)
 * 
 * This way:
 * - Admin can manage subjects (add/edit/delete) via /api/admin/subjects
 * - Students can view subjects for their semester via /api/subjects?semester=1
 * - Both use the same Subject model in the database
 * 
 * AVAILABLE ROUTES:
 * ================
 * GET /api/subjects              → Fetch all subjects
 * GET /api/subjects?semester=1   → Fetch only semester 1 subjects
 * GET /api/subjects?semester=2   → Fetch only semester 2 subjects
 * 
 * SECURITY:
 * =========
 * - Still requires JWT token (auth middleware)
 * - But doesn't require admin role — any logged-in user can access
 * - This is how students see their semester's subjects
 */

const express = require('express');
const Subject = require('../models/Subject');
const auth = require('../middleware/auth');

const router = express.Router();

// Simple in-memory TTL cache for the near-static subjects list (see GET / below)
const subjectCache = new Map();

/**
 * GET /api/subjects
 * 
 * Purpose: Fetch subjects (any logged-in user can access)
 * 
 * What happens:
 * 1. auth middleware verifies JWT token (user must be logged in)
 * 2. Reads optional ?semester= query parameter
 * 3. If semester provided → filters subjects by that semester
 * 4. If no semester → returns all subjects
 * 5. Returns subject list sorted by semester and code
 * 
 * Query params (optional):
 * - ?semester=1 → only semester 1 subjects
 * - ?semester=2 → only semester 2 subjects
 * 
 * Example usage by students:
 * - Student in semester 1 calls: GET /api/subjects?semester=1
 * - Student in semester 2 calls: GET /api/subjects?semester=2
 * - Both get only their semester's subjects
 * 
 * Response: { subjects: [{ name, code, semester, course, ... }, ...] }
 */
router.get('/', auth, async (req, res) => {
  try {
    // Build filter from query parameters
    const filter = {};
    if (req.query.semester) {
      filter.semester = Number(req.query.semester);
    }
    if (req.query.course) {
      filter.course = req.query.course;
    }

    // Subjects are near-static data — serve from a short-lived in-memory cache
    // keyed by filter, so thousands of students loading their dashboard don't
    // each hit MongoDB. Invalidated implicitly by the 30s TTL.
    const cacheKey = JSON.stringify(filter);
    const cached = subjectCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 30000) {
      return res.json({ subjects: cached.data });
    }

    // Fetch subjects sorted by semester (1, 2, 3...) then by code
    const subjects = await Subject.find(filter).sort({ semester: 1, code: 1 }).lean();
    subjectCache.set(cacheKey, { at: Date.now(), data: subjects });
    if (subjectCache.size > 100) {
      const oldest = subjectCache.keys().next().value;
      subjectCache.delete(oldest);
    }

    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
