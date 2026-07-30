const nodemailer = require('nodemailer');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Submission = require('../models/Submission');

let transporter = null;
let transporterResolve = null;

async function getTransporter() {
  if (transporter) return transporter;
  if (transporterResolve) return transporterResolve;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    transporterResolve = transporter;
    console.log('[NOTIFICATION] Email transporter configured with', process.env.EMAIL_HOST);
    return transporter;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    transporterResolve = transporter;
    console.log('[NOTIFICATION] Using Ethereal test account:', testAccount.user);
    console.log('[NOTIFICATION] View captured emails at https://ethereal.email/login');
    return transporter;
  } catch (err) {
    console.error('[NOTIFICATION] Failed to create Ethereal account:', err.message);
    return null;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return 'N/A';
  const [h, m] = timeStr.split(':');
  const hr = Number(h);
  return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

async function sendEmail({ to, subject, html }) {
  const transport = await getTransporter();
  if (!transport) {
    console.log(`[NOTIFICATION] Skipping email to ${to} — no transporter configured`);
    return { sent: false, reason: 'no_transporter' };
  }
  try {
    const from = process.env.EMAIL_FROM || 'noreply@online-examination-sou.com';
    const info = await transport.sendMail({ from: `"SOU Examination" <${from}>`, to, subject, html });
    const isEthereal = transport.options?.host === 'smtp.ethereal.email';
    if (isEthereal && info.messageId) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('[NOTIFICATION] Ethereal preview:', previewUrl);
    }
    console.log(`[NOTIFICATION] Email sent to ${to}: ${subject}`);
    return { sent: true };
  } catch (err) {
    console.error(`[NOTIFICATION] Failed to send email to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

async function notifyExamReminder(exam) {
  if (!exam || !exam._id) return { sent: 0, total: 0, error: 'Invalid exam' };
  try {
    const students = await User.find({ role: 'user', semester: String(exam.semester), course: exam.course });
    if (!students.length) return { sent: 0, total: 0, error: 'No eligible students found' };

    const transport = await getTransporter();
    if (!transport) return { sent: 0, total: students.length, error: 'Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env' };

    let sent = 0;
    for (const student of students) {
      if (!student.email) continue;
      const result = await sendEmail({
        to: student.email,
        subject: `📝 Exam Reminder: ${exam.subjectName} — ${formatDate(exam.date)} at ${formatTime(exam.time)}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8faf9;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h2 style="color:#176B3A;margin:0">Silver Oak University</h2>
            <p style="color:#667085;margin:4px 0 0">Online Examination System</p>
          </div>
          <div style="background:white;padding:24px;border-radius:12px;border:1px solid #D9E2DC">
            <h3 style="color:#176B3A;margin:0 0 16px">📝 Exam Scheduled!</h3>
            <p style="color:#1F2933;margin:8px 0">Dear <strong>${student.name}</strong>,</p>
            <p style="color:#1F2933;margin:8px 0">You have an exam scheduled as follows:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Subject</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${exam.subjectName} (${exam.subjectCode})</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Date</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${formatDate(exam.date)}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Time</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${formatTime(exam.time)}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Duration</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${exam.duration} minutes</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Type</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${exam.examType === 'mcq' ? 'MCQ' : 'Practical'}</td></tr>
            </table>
            <p style="color:#667085;font-size:13px;margin:16px 0 0">Please log in to the examination portal before the scheduled time. Make sure you have a stable internet connection.</p>
          </div>
          <p style="color:#667085;font-size:12px;text-align:center;margin-top:16px">Silver Oak University — Online Examination System</p>
        </div>`
      });
      if (result.sent) sent++;
    }
    const isEthereal = transport?.options?.host === 'smtp.ethereal.email';
    return { sent, total: students.length, isEthereal, error: null };
  } catch (err) {
    console.error('[NOTIFICATION] Exam reminder error:', err.message);
    return { sent: 0, total: 0, error: err.message };
  }
}

async function notifyResultPublished(exam) {
  if (!exam || !exam._id) return { sent: 0, total: 0, error: 'Invalid exam' };
  try {
    const submissions = await Submission.find({ examId: exam._id }).populate('studentId', 'name email');
    if (!submissions.length) return { sent: 0, total: 0, error: 'No submissions found' };

    const transport = await getTransporter();
    if (!transport) return { sent: 0, total: submissions.length, error: 'Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env' };

    let sent = 0;
    for (const sub of submissions) {
      if (!sub.studentId || !sub.studentId.email) continue;
      const result = await sendEmail({
        to: sub.studentId.email,
        subject: `📊 Results Published: ${exam.subjectName}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8faf9;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h2 style="color:#176B3A;margin:0">Silver Oak University</h2>
            <p style="color:#667085;margin:4px 0 0">Online Examination System</p>
          </div>
          <div style="background:white;padding:24px;border-radius:12px;border:1px solid #D9E2DC">
            <h3 style="color:#176B3A;margin:0 0 16px">📊 Results Published!</h3>
            <p style="color:#1F2933;margin:8px 0">Dear <strong>${sub.studentId.name}</strong>,</p>
            <p style="color:#1F2933;margin:8px 0">Your results for <strong>${exam.subjectName} (${exam.subjectCode})</strong> have been published.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Subject</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${exam.subjectName} (${exam.subjectCode})</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Your Score</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${sub.score} / ${sub.totalMarks}</td></tr>
              <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Status</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${sub.status === 'evaluated' || sub.status === 'graded' ? 'Completed' : sub.status}</td></tr>
            </table>
            <p style="margin-top:16px;text-align:center"><a href="${process.env.FRONTEND_URL || 'https://online-examination-sou.vercel.app'}/dashboard" style="display:inline-block;padding:12px 24px;background:#176B3A;color:white;text-decoration:none;border-radius:8px;font-weight:600">View Full Results</a></p>
          </div>
          <p style="color:#667085;font-size:12px;text-align:center;margin-top:16px">Silver Oak University — Online Examination System</p>
        </div>`
      });
      if (result.sent) sent++;
    }
    const isEthereal = transport?.options?.host === 'smtp.ethereal.email';
    return { sent, total: submissions.length, isEthereal, error: null };
  } catch (err) {
    console.error('[NOTIFICATION] Result publish error:', err.message);
    return { sent: 0, total: 0, error: err.message };
  }
}

async function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: 'Test Email — SOU Examination System',
    html: '<h2>✅ Test email from SOU Examination System</h2><p>If you received this, email notifications are working.</p>'
  });
}

module.exports = { notifyExamReminder, notifyResultPublished, sendTestEmail };
