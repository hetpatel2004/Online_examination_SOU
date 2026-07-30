const express = require('express');
const Exam = require('../models/Exam');
const auth = require('../middleware/auth');
const { notifyExamReminder, notifyResultPublished, sendTestEmail } = require('../services/notificationService');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

router.post('/send-reminder/:examId', auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const result = await notifyExamReminder(exam);
    res.json({ message: `Reminder sent to ${result.sent} of ${result.total} students`, result });
  } catch (err) {
    console.error('[NOTIFY] Reminder error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post('/send-results/:examId', auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const result = await notifyResultPublished(exam);
    res.json({ message: `Results notified to ${result.sent} of ${result.total} students`, result });
  } catch (err) {
    console.error('[NOTIFY] Results error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post('/test-email', auth, adminOnly, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const result = await sendTestEmail(email);
    res.json({ message: result.sent ? 'Test email sent' : 'Failed to send', result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
