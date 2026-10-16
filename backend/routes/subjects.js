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

const Course = require('../models/Course');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/subjects
 * 
 * Purpose: Fetch subjects (any logged-in user can access)
 * Dynamic course & semester matching:
 * Matches both course name (e.g. 'MCA') and course code (e.g. '1234567') case-insensitively.
 */
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.semester) {
      filter.semester = Number(req.query.semester);
    }
    if (req.query.course) {
      const rawCourse = String(req.query.course).trim();
      const courseDoc = await Course.findOne({
        $or: [
          { name: new RegExp(`^${escapeRegex(rawCourse)}$`, 'i') },
          { code: new RegExp(`^${escapeRegex(rawCourse)}$`, 'i') }
        ]
      }).lean();

      const courseMatches = new Set([rawCourse]);
      if (courseDoc) {
        if (courseDoc.name) courseMatches.add(courseDoc.name);
        if (courseDoc.code) courseMatches.add(courseDoc.code);
      }

      filter.course = {
        $in: Array.from(courseMatches).map(c => new RegExp(`^${escapeRegex(c)}$`, 'i'))
      };
    }

    // Always fetch fresh subjects sorted by semester then code
    const subjects = await Subject.find(filter).sort({ semester: 1, code: 1 }).lean();
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
