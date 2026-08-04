/**
 * Notification Service — emails students (nodemailer/SMTP) and sends SMS
 * (Fast2SMS API) for exam reminders and published results.
 * .env keys: EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS,
 * EMAIL_FROM, FAST2SMS_API_KEY, FAST2SMS_SENDER_ID, FRONTEND_URL.
 * If no SMTP keys are set, emails fall back to an Ethereal test inbox.
 */
const nodemailer = require('nodemailer');
const https = require('https');
const dns = require('dns');
// Some hosts (e.g. Render) can't reach Gmail's IPv6 address and fail with
// ENETUNREACH. Force DNS to resolve IPv4 addresses first so SMTP connects.
dns.setDefaultResultOrder('ipv4first');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Submission = require('../models/Submission');

let transporter = null;
let transporterResolve = null;
let transporterSource = null; // 'smtp' (real SMTP from .env) or 'ethereal' (test inbox)

// Build a Gmail/SMTP transporter with safe timeouts. Used for the main config
// and for the automatic port failover (587 STARTTLS <-> 465 implicit TLS).
function createSmtpTransporter(port, secure) {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// True when the SMTP connection itself failed (as opposed to a bad-credential
// 535) — the case where a port failover is worth trying.
function isConnectError(err) {
  const msg = (err && (err.code || err.message)) || '';
  return /(ETIMEDOUT|ENETUNREACH|ECONNREFUSED|ECONNRESET|ESOCKET|socket hang up|connect)/i.test(String(msg));
}

// Reuse a single transporter. Prefers real SMTP from .env; otherwise creates
// a throwaway Ethereal test account so emails can be previewed during dev.
async function getTransporter() {
  if (transporter) return transporter;
  if (transporterResolve) return transporterResolve;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Detect leftover placeholder values from .env.example so mail silently "not
    // sending" is impossible to miss (Gmail rejects these with 535 BadCredentials).
    if (process.env.EMAIL_USER.includes('your_') || process.env.EMAIL_PASS.includes('your_')) {
      console.warn('[NOTIFICATION] ⚠️ EMAIL_USER / EMAIL_PASS in .env are still PLACEHOLDERS — no emails will be delivered!');
      console.warn('[NOTIFICATION] Fix: put your real Gmail address + a 16-char App Password in backend/.env');
    }
    transporter = createSmtpTransporter(
      Number(process.env.EMAIL_PORT) || 587,
      process.env.EMAIL_SECURE === 'true'
    );
    transporterResolve = transporter;
    transporterSource = 'smtp';
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
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    transporterResolve = transporter;
    transporterSource = 'ethereal';
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

// Send one HTML email via the configured transporter (real SMTP or Ethereal).
// On a connection-level failure with real SMTP, retries once on the alternate
// port (587 <-> 465) — some hosts (e.g. Render) only allow one of them.
// Send via Resend's HTTPS API (port 443). Render's free tier blocks outbound
// SMTP (587/465) but allows HTTPS, so an API is the reliable path there.
// Requires .env: RESEND_API_KEY + RESEND_FROM (defaults to onboarding@resend.dev,
// which only delivers to the account owner's own inbox — verify a domain for real sends).
async function sendEmailViaResend({ to, subject, html }) {
  try {
    const from = process.env.RESEND_FROM || 'SOU Examination <onboarding@resend.dev>';
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      return { sent: false, reason: `Resend ${resp.status}: ${body.substring(0, 200)}`, source: 'resend-api', host: 'api.resend.com' };
    }
    console.log(`[NOTIFICATION] Email sent to ${to} via Resend API: ${subject}`);
    return { sent: true, source: 'resend-api', host: 'api.resend.com' };
  } catch (err) {
    console.error('[NOTIFICATION] Resend API send failed:', err.message);
    return { sent: false, reason: err.message, source: 'resend-api', host: 'api.resend.com' };
  }
}

async function sendEmail({ to, subject, html }) {
  // Prefer the HTTPS email API when configured (works on Render); SMTP below is
  // used for local dev or when no API key is set.
  if (process.env.RESEND_API_KEY) {
    return sendEmailViaResend({ to, subject, html });
  }

  const from = process.env.EMAIL_FROM || 'noreply@online-examination-sou.com';
  const mailOpts = {
    from: `"SOU Examination" <${from}>`,
    to, subject, html,
    // Hard cap per message so a stuck SMTP server can't block callers for long
    timeout: 15000,
  };

  let transport = await getTransporter();
  if (!transport) {
    console.log(`[NOTIFICATION] Skipping email to ${to} — no transporter configured`);
    return { sent: false, reason: 'no_transporter', source: transporterSource, host: null };
  }

  const trySend = async (t) => {
    try {
      const info = await t.sendMail(mailOpts);
      const isEthereal = t.options?.host === 'smtp.ethereal.email';
      if (isEthereal && info.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) console.log('[NOTIFICATION] Ethereal preview:', previewUrl);
      }
      console.log(`[NOTIFICATION] Email sent to ${to}: ${subject}`);
      return { sent: true, source: transporterSource, host: t.options?.host };
    } catch (err) {
      return { sent: false, reason: err.message, source: transporterSource, host: t.options?.host, code: err.code };
    }
  };

  let result = await trySend(transport);

  // Failover: real SMTP connection problem → try the opposite port once
  if (!result.sent && transporterSource === 'smtp' && isConnectError(result)) {
    const currentPort = Number(process.env.EMAIL_PORT) || 587;
    const altPort = currentPort === 465 ? 587 : 465;
    const altSecure = altPort === 465;
    console.log(`[NOTIFICATION] Retrying ${process.env.EMAIL_HOST} on port ${altPort} (secure=${altSecure})`);
    try {
      const alt = createSmtpTransporter(altPort, altSecure);
      result = await trySend(alt);
      if (result.sent) {
        // Cache the working transporter for future sends
        transporter = alt;
        transporterResolve = alt;
      }
    } catch (failoverErr) {
      result = { sent: false, reason: failoverErr.message, source: 'smtp', host: process.env.EMAIL_HOST };
    }
  }

  if (!result.sent) console.error(`[NOTIFICATION] Failed to send email to ${to}:`, result.reason);
  return result;
}

// Send one SMS through the Fast2SMS bulk API using FAST2SMS_API_KEY from .env
async function sendSMS({ to, message }) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.log(`[SMS] Skipping SMS to ${to} — FAST2SMS_API_KEY not set`);
    return { sent: false, reason: 'no_api_key' };
  }
  const senderId = process.env.FAST2SMS_SENDER_ID || 'SOUEXM';
  return new Promise((resolve) => {
    const data = JSON.stringify({
      sender_id: senderId,
      message,
      language: 'english',
      route: 'q',
      numbers: to.replace(/[^0-9]/g, '')
    });
    const req = https.request({
      hostname: 'www.fast2sms.com',
      path: '/dev/bulkV2',
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.return) {
            console.log(`[SMS] Sent to ${to}`);
            resolve({ sent: true });
          } else {
            console.error(`[SMS] Failed for ${to}:`, parsed.message || body);
            resolve({ sent: false, reason: parsed.message || body });
          }
        } catch {
          console.error(`[SMS] Failed for ${to}:`, body);
          resolve({ sent: false, reason: body });
        }
      });
    });
    req.on('error', (err) => {
      console.error(`[SMS] Error for ${to}:`, err.message);
      resolve({ sent: false, reason: err.message });
    });
    req.write(data);
    req.end();
  });
}

// Email + SMS every eligible student (same course & semester) about an upcoming exam
async function notifyExamReminder(exam) {
  if (!exam || !exam._id) return { sent: 0, total: 0, error: 'Invalid exam', smsSent: 0 };
  try {
    const students = await User.find({ role: 'user', semester: String(exam.semester), course: exam.course });
    if (!students.length) return { sent: 0, total: 0, error: 'No eligible students found', smsSent: 0 };

    const transport = await getTransporter();

    let sent = 0, smsSent = 0;
    for (const student of students) {
      // Email
      if (student.email && transport) {
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
      // SMS
      if (student.phone) {
        const smsResult = await sendSMS({
          to: student.phone,
          message: `SOU Exam Reminder: ${exam.subjectName} on ${formatDate(exam.date)} at ${formatTime(exam.time)}. Duration: ${exam.duration} mins. Please login to the portal on time.`
        });
        if (smsResult.sent) smsSent++;
      }
    }
    const isEthereal = transport?.options?.host === 'smtp.ethereal.email';
    return { sent, total: students.length, isEthereal, error: null, smsSent };
  } catch (err) {
    console.error('[NOTIFICATION] Exam reminder error:', err.message);
    return { sent: 0, total: 0, error: err.message, smsSent: 0 };
  }
}

// Email + SMS every student who submitted, once the exam results are published
async function notifyResultPublished(exam) {
  if (!exam || !exam._id) return { sent: 0, total: 0, error: 'Invalid exam', smsSent: 0 };
  try {
    const submissions = await Submission.find({ examId: exam._id }).populate('studentId', 'name email phone');
    if (!submissions.length) return { sent: 0, total: 0, error: 'No submissions found', smsSent: 0 };

    const transport = await getTransporter();

    let sent = 0, smsSent = 0;
    for (const sub of submissions) {
      if (!sub.studentId) continue;
      // Email
      if (sub.studentId.email && transport) {
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
      // SMS
      if (sub.studentId.phone) {
        const smsResult = await sendSMS({
          to: sub.studentId.phone,
          message: `SOU Result: ${exam.subjectName} — Score ${sub.score}/${sub.totalMarks}. Login to portal to view full results.`
        });
        if (smsResult.sent) smsSent++;
      }
    }
    const isEthereal = transport?.options?.host === 'smtp.ethereal.email';
    return { sent, total: submissions.length, isEthereal, error: null, smsSent };
  } catch (err) {
    console.error('[NOTIFICATION] Result publish error:', err.message);
    return { sent: 0, total: 0, error: err.message, smsSent: 0 };
  }
}

// Email new admin their login credentials (ID, password, role) right after
// the super admin creates the account. Never blocks admin creation if email fails.
async function notifyAdminCredentials({ to, name, enrollmentNumber, password, role }) {
  return sendEmail({
    to,
    subject: '🎉 Your SOU Examination System Login Credentials',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8faf9;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <h2 style="color:#176B3A;margin:0">Silver Oak University</h2>
        <p style="color:#667085;margin:4px 0 0">Online Examination System — Account Created</p>
      </div>
      <div style="background:white;padding:24px;border-radius:12px;border:1px solid #D9E2DC">
        <h3 style="color:#176B3A;margin:0 0 16px">Dear <strong>${name}</strong>,</h3>
        <p style="color:#1F2933;margin:8px 0">An admin account has been created for you. Use the details below to log in:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Login ID (Enrollment)</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${enrollmentNumber}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Password</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${password}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #D9E2DC;background:#E8F3EC;font-weight:600;color:#176B3A">Role</td><td style="padding:8px 12px;border:1px solid #D9E2DC">${role}</td></tr>
        </table>
        <p style="color:#667085;font-size:13px;margin:16px 0 0">Please log in at the administration portal and change your password for security. Do not share these credentials with anyone.</p>
      </div>
      <p style="color:#667085;font-size:12px;text-align:center;margin-top:16px">Silver Oak University — Online Examination System</p>
    </div>`
  });
}

async function sendTestEmail(to) {
  return sendEmail({
    to,
    subject: 'Test Email — SOU Examination System',
    html: '<h2>✅ Test email from SOU Examination System</h2><p>If you received this, email notifications are working.</p>'
  });
}

module.exports = { notifyExamReminder, notifyResultPublished, notifyAdminCredentials, sendTestEmail };
