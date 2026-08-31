const express = require('express');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Course = require('../models/Course');
const { notifyAdminCredentials } = require('../services/notificationService');

const router = express.Router();

// Simple in-memory TTL cache for the public course list (near-static data, hit
// on every registration page load). 30s TTL keeps it fresh enough.
const courseCache = { at: 0, data: null };

const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied. Super Admin only.' });
  }
  next();
};

// ============================================================
// PUBLIC COURSES LIST (for registration, no auth needed)
// ============================================================
router.get('/courses/public', async (req, res) => {
  try {
    if (courseCache.data && Date.now() - courseCache.at < 30000) {
      return res.json({ courses: courseCache.data });
    }
    const courses = await Course.find().sort({ code: 1 }).lean();
    courseCache.at = Date.now();
    courseCache.data = courses;
    res.json({ courses });
  } catch (error) {
    console.error('Error fetching public courses:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// DASHBOARD STATS
// ============================================================
router.get('/students', auth, superAdminOnly, async (req, res) => {
  try {
    const { program, semester } = req.query;
    const filter = {};
    if (program) filter.course = program;
    if (semester) filter.semester = semester;
    
    const users = await User.find(filter)
      .select('-password -aadharNumber')
      .sort({ course: 1, semester: 1, name: 1 })
      .lean();
    
    res.json({ users });
  } catch (error) {
    console.error('Error fetching students:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', auth, superAdminOnly, async (req, res) => {
  try {
    // Run all counts in parallel (single round-trip each) instead of sequentially
    const [totalAdmins, totalStudents, totalSubjects, assignedSubjects, totalCourses] = await Promise.all([
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'user' }),
      Subject.countDocuments(),
      Subject.countDocuments({ assignedTo: { $exists: true, $ne: [] } }),
      Course.countDocuments(),
    ]);

    res.json({ totalAdmins, totalStudents, totalSubjects, assignedSubjects, totalCourses });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// ADMIN CRUD
// ============================================================
router.get('/admins', auth, superAdminOnly, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password -aadharNumber')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/admins', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, enrollmentNumber, email, phone, course, semester, password, credentialsEmail } = req.body;

    if (!name || !enrollmentNumber || !email || !phone || !course || !semester || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (enrollmentNumber.toUpperCase().startsWith('SUPER')) {
      return res.status(400).json({ message: 'Cannot create Super Admin accounts from here' });
    }

    const existingEnrollment = await User.findOne({ enrollmentNumber: enrollmentNumber.toUpperCase() });
    if (existingEnrollment) {
      return res.status(400).json({ message: 'Enrollment number already exists' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = new User({
      name,
      enrollmentNumber: enrollmentNumber.toUpperCase(),
      email,
      phone,
      course,
      semester,
      aadharNumber: password,
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();

    // Email the new admin their login credentials (ID, password, role).
    // Fire-and-forget: SMTP can be slow/hang, so never block the response on it.
    // The admin is already saved, so a mail failure cannot lose the account.
    notifyAdminCredentials({
      to: credentialsEmail || admin.email,
      name: admin.name,
      enrollmentNumber: admin.enrollmentNumber,
      password,
      role: 'Admin'
    }).then((emailStatus) => {
      console.log(`[CREDS-EMAIL] ${emailStatus.sent ? 'SENT' : 'FAILED'} to ${credentialsEmail || admin.email}: ${emailStatus.sent ? '' : emailStatus.reason}`);
    }).catch((emailErr) => {
      console.error('[CREDS-EMAIL] Failed:', emailErr.message);
    });

    res.status(201).json({
      message: 'Admin created successfully — login credentials are being emailed',
      emailSent: null, // sent asynchronously; result is logged server-side
      admin: {
        _id: admin._id, name: admin.name, enrollmentNumber: admin.enrollmentNumber,
        email: admin.email, phone: admin.phone, course: admin.course,
        semester: admin.semester, role: admin.role, createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating admin:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/admins/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (admin.role !== 'admin') return res.status(400).json({ message: 'Can only delete admin accounts' });

    await Subject.updateMany({ assignedTo: admin._id }, { $pull: { assignedTo: admin._id } });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// COURSE CRUD
// ============================================================
router.get('/courses', auth, superAdminOnly, async (req, res) => {
  try {
    const courses = await Course.find().sort({ code: 1 });
    res.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/courses', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, code, description, level, totalSemesters } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and code are required' });
    }

    const existing = await Course.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ message: 'Program code already exists' });
    }

    const course = new Course({
      name, code: code.toUpperCase(), description: description || '',
      level: level || 'postgraduation',
      totalSemesters: level === 'graduation' ? 6 : (totalSemesters || 4)
    });
    await course.save();
    res.status(201).json({ message: 'Program created', course });
  } catch (error) {
    console.error('Error creating course:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/courses/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, code, description, level, totalSemesters } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Program not found' });

    if (code && code.toUpperCase() !== course.code) {
      const existing = await Course.findOne({ code: code.toUpperCase() });
      if (existing) return res.status(400).json({ message: 'Course code already exists' });
      course.code = code.toUpperCase();
    }
    if (name) course.name = name;
    if (description !== undefined) course.description = description;
    if (level) {
      course.level = level;
      course.totalSemesters = level === 'graduation' ? 6 : (totalSemesters || 4);
    } else if (totalSemesters) {
      course.totalSemesters = totalSemesters;
    }

    await course.save();
    res.json({ message: 'Program updated', course });
  } catch (error) {
    console.error('Error updating course:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/courses/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Program not found' });

    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: 'Program deleted' });
  } catch (error) {
    console.error('Error deleting course:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// SUBJECT CRUD + ASSIGNMENT
// ============================================================
router.get('/subjects', auth, superAdminOnly, async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate('assignedTo', 'name enrollmentNumber email')
      .sort({ course: 1, semester: 1, name: 1 });
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/subjects', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, code, semester, course, description } = req.body;
    if (!name || !code || !semester || !course) {
      return res.status(400).json({ message: 'Name, code, semester, and program are required' });
    }

    const existing = await Subject.findOne({ code });
    if (existing) return res.status(400).json({ message: 'Subject code already exists' });

    const subject = new Subject({ name, code, semester, course, description: description || '' });
    await subject.save();
    res.status(201).json({ message: 'Subject created', subject });
  } catch (error) {
    console.error('Error creating subject:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/subjects/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const { name, code, semester, course, description } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    if (code && code !== subject.code) {
      const existing = await Subject.findOne({ code });
      if (existing) return res.status(400).json({ message: 'Subject code already exists' });
      subject.code = code;
    }
    if (name) subject.name = name;
    if (semester) subject.semester = semester;
    if (course) subject.course = course;
    if (description !== undefined) subject.description = description;

    await subject.save();
    res.json({ message: 'Subject updated', subject });
  } catch (error) {
    console.error('Error updating subject:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/subjects/:id', auth, superAdminOnly, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    await Subject.findByIdAndDelete(req.params.id);
    res.json({ message: 'Subject deleted' });
  } catch (error) {
    console.error('Error deleting subject:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/subjects/:id/assign', auth, superAdminOnly, async (req, res) => {
  try {
    const { adminId, action } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Ensure assignedTo is always an array
    if (!Array.isArray(subject.assignedTo)) {
      subject.assignedTo = subject.assignedTo ? [subject.assignedTo] : [];
    }

    if (adminId) {
      const admin = await User.findById(adminId);
      if (!admin || admin.role !== 'admin') {
        return res.status(404).json({ message: 'Admin not found' });
      }

      if (action === 'remove') {
        // Remove this admin from the subject
        subject.assignedTo = subject.assignedTo.filter(id => id.toString() !== adminId);
      } else {
        // Add admin if not already assigned
        if (!subject.assignedTo.some(id => id.toString() === adminId)) {
          subject.assignedTo.push(adminId);
        }
      }
    }

    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate('assignedTo', 'name enrollmentNumber email');

    res.json({ message: 'Subject assignment updated', subject: populated });
  } catch (error) {
    console.error('Error assigning subject:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
