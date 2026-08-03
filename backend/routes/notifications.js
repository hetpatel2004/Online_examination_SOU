// Email/SMS notification endpoints (admin only) — call the notificationService
// to remind students about an exam, publish results, or send a test email.
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

// Send exam-reminder emails/SMS to all eligible students of an exam
router.post('/send-reminder/:examId', auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const result = await notifyExamReminder(exam);
    let msg = result.sent > 0 || result.smsSent > 0
      ? `✓ Emails sent to ${result.sent}, SMS sent to ${result.smsSent} of ${result.total} students`
      : result.error
      ? `✗ Failed: ${result.error}`
      : `No notifications sent (${result.total} students found)`;
    if (result.isEthereal && result.sent > 0) msg += ' (Email via Ethereal test — https://ethereal.email/login)';
    res.json({ message: msg, result });
  } catch (err) {
    console.error('[NOTIFY] Reminder error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Send result-published emails/SMS to every student who submitted the exam
router.post('/send-results/:examId', auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.examId);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const result = await notifyResultPublished(exam);
    let msg = result.sent > 0 || result.smsSent > 0
      ? `✓ Emails sent to ${result.sent}, SMS sent to ${result.smsSent} of ${result.total} students`
      : result.error
      ? `✗ Failed: ${result.error}`
      : `No notifications sent (${result.total} submissions found)`;
    if (result.isEthereal && result.sent > 0) msg += ' (Email via Ethereal test — https://ethereal.email/login)';
    res.json({ message: msg, result });
  } catch (err) {
    console.error('[NOTIFY] Results error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Send a plain test email to a given address to verify SMTP/.env config
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
