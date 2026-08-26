const nodemailer = require('nodemailer');

/**
 * Sends low attendance warning email to a student via Resend HTTPS API or SMTP fallback.
 */
async function sendLowAttendanceWarningEmail({
  to,
  studentName,
  courseCode,
  courseName,
  sectionName,
  teacherName,
  attendancePct,
  attendedCount,
  totalCount,
}) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const user = (process.env.SMTP_USER || '').trim();

  // For Resend: use onboarding@resend.dev unless a custom verified domain is explicitly provided
  let fromAddress = 'ClassPulse Academic Alert <onboarding@resend.dev>';
  if (process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('@gmail.com') && !process.env.EMAIL_FROM.includes('@resend.com')) {
    fromAddress = process.env.EMAIL_FROM;
  } else if (!resendApiKey && user) {
    fromAddress = `"ClassPulse Academic Alert" <${user}>`;
  }

  const subject = `⚠️ [ClassPulse Warning] Low Attendance Alert in ${courseCode} (${attendancePct}%)`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f9; color: #1e1b16; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e7e0ec; overflow: hidden; }
        .header { background-color: #6750A4; padding: 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
        .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }
        .content { padding: 28px 24px; }
        .alert-box { background-color: #FFF3E0; border-left: 4px solid #E65100; border-radius: 4px; padding: 16px; margin: 20px 0; }
        .alert-title { font-weight: 700; color: #E65100; margin-bottom: 4px; }
        .stats-grid { display: flex; justify-content: space-around; background-color: #F3EDF7; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 24px; font-weight: 800; color: #B3261E; }
        .stat-label { font-size: 11px; font-weight: 700; color: #49454F; text-transform: uppercase; margin-top: 4px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .info-table td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #F3EDF7; }
        .info-table td:first-child { font-weight: 600; color: #49454F; width: 35%; }
        .footer { background-color: #F3EDF7; padding: 16px; text-align: center; font-size: 12px; color: #79747E; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ClassPulse Academic Notification</h1>
          <p>Official Attendance Shortage Advisory</p>
        </div>
        <div class="content">
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>This automated advisory is to inform you that your cumulative attendance for <strong>${courseCode} — ${courseName}</strong> has fallen below the mandatory <strong>75%</strong> institutional requirement.</p>
          
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">${attendancePct}%</div>
              <div class="stat-label">Current Rate</div>
            </div>
            <div class="stat-item">
              <div class="stat-value" style="color: #6750A4;">${attendedCount} / ${totalCount}</div>
              <div class="stat-label">Attended Classes</div>
            </div>
          </div>

          <table class="info-table">
            <tr>
              <td>Course:</td>
              <td><strong>${courseCode} — ${courseName}</strong></td>
            </tr>
            <tr>
              <td>Section:</td>
              <td>${sectionName}</td>
            </tr>
            <tr>
              <td>Instructor:</td>
              <td>${teacherName}</td>
            </tr>
            <tr>
              <td>Status:</td>
              <td><span style="color: #B3261E; font-weight: 700;">⚠️ Attendance Shortage Warning</span></td>
            </tr>
          </table>

          <div class="alert-box">
            <div class="alert-title">Required Action:</div>
            <div style="font-size: 13px; color: #5D4037;">
              Please ensure regular attendance in upcoming sessions to maintain eligibility for examinations. If you have valid medical or academic reasons for missed sessions, please consult your course instructor directly.
            </div>
          </div>

          <p style="font-size: 13px; color: #49454F;">You can review your detailed session history and real-time attendance log anytime on the ClassPulse mobile app.</p>
        </div>
        <div class="footer">
          ClassPulse Engagement Platform &bull; Automated System Notice &bull; Do not reply to this email
        </div>
      </div>
    </body>
    </html>
  `;

  const plainText = `ClassPulse Attendance Shortage Warning

Dear ${studentName},

This is an official advisory regarding your attendance in ${courseCode} — ${courseName} (Section: ${sectionName}).

Your cumulative attendance is currently ${attendancePct}% (${attendedCount} attended out of ${totalCount} sessions), which is below the mandatory 75% threshold.

Instructor: ${teacherName}
Status: Shortage Warning

Please ensure you attend all upcoming lectures to meet the minimum eligibility criteria. You can view your complete session history on the ClassPulse mobile application.

-- 
ClassPulse Academic Notification Platform`;

  // 1. Primary Cloud Method: Resend HTTPS API (Port 443 — Never blocked by cloud firewalls)
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'ClassPulse Academic Alert <onboarding@resend.dev>',
          to: [to],
          subject,
          text: plainText,
          html: htmlContent,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || resData.error || `Resend API failed with status ${response.status}`);
      }

      return { messageId: resData.id || `resend_${Date.now()}` };
    } catch (apiErr) {
      console.error('Error dispatching via Resend HTTPS API:', apiErr);
      throw apiErr;
    }
  }

  // 2. Secondary Fallback: SMTP (For local development on machine)
  const host = (process.env.SMTP_HOST || '').trim();
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (host && user && pass) {
    const isGmail = host.toLowerCase().includes('gmail') || user.toLowerCase().endsWith('@gmail.com');

    const mailTransporter = nodemailer.createTransport({
      host: isGmail ? 'smtp.gmail.com' : host,
      port: isGmail ? 465 : port,
      secure: isGmail ? true : port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: plainText,
      html: htmlContent,
    });

    return info;
  }

  // 3. Fallback: Simulation mode
  console.log('--- [EMAIL DISPATCH SIMULATION (No API Key or SMTP configured)] ---');
  console.log(`To: ${to}`);
  console.log(`From: ${fromAddress}`);
  console.log(`Subject: ${subject}`);
  console.log('-------------------------------------------------------------------');
  return { messageId: `mock_${Date.now()}` };
}

module.exports = {
  sendLowAttendanceWarningEmail,
};
