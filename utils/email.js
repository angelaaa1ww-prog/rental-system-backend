const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendLoginAlert = async (toEmail, deviceInfo) => {
  const { browser, device, ip, time, date } = deviceInfo;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#0F172A;border-radius:16px;overflow:hidden;border:1px solid #1E293B">
      <div style="background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:28px 24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:22px">🔒 New Device Login Alert</h1>
        <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">Gifted Hands Ventures — Property Management</p>
      </div>
      <div style="padding:24px">
        <p style="color:#CBD5E1;font-size:14px;line-height:1.6;margin:0 0 18px">
          A new login to your admin account was detected:
        </p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:10px 12px;color:#94A3B8;font-size:12px;border-bottom:1px solid #1E293B">Device</td><td style="padding:10px 12px;color:#F1F5F9;font-size:13px;font-weight:600;border-bottom:1px solid #1E293B">${device}</td></tr>
          <tr><td style="padding:10px 12px;color:#94A3B8;font-size:12px;border-bottom:1px solid #1E293B">Browser</td><td style="padding:10px 12px;color:#F1F5F9;font-size:13px;font-weight:600;border-bottom:1px solid #1E293B">${browser}</td></tr>
          <tr><td style="padding:10px 12px;color:#94A3B8;font-size:12px;border-bottom:1px solid #1E293B">IP Address</td><td style="padding:10px 12px;color:#F1F5F9;font-size:13px;font-weight:600;border-bottom:1px solid #1E293B">${ip}</td></tr>
          <tr><td style="padding:10px 12px;color:#94A3B8;font-size:12px">Time</td><td style="padding:10px 12px;color:#F1F5F9;font-size:13px;font-weight:600">${time}, ${date}</td></tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#1E293B;border-radius:10px;border-left:4px solid #EF4444">
          <p style="color:#FCA5A5;font-size:13px;margin:0;font-weight:600">⚠️ If this wasn't you, change your password immediately and contact support.</p>
        </div>
      </div>
      <div style="padding:16px 24px;background:#0B1120;text-align:center">
        <p style="color:#475569;font-size:11px;margin:0">Gifted Hands Ventures © ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: \`"GHV Security" <\${process.env.EMAIL_USER}>\`,
      to: toEmail,
      subject: \`🔒 New Login Detected — \${device}/\${browser} at \${time}\`,
      html,
    });
    console.log(\`📧 Login alert email sent to \${toEmail}\`);
  } catch (err) {
    console.error('📧 Email alert failed:', err.message);
  }
};

module.exports = { sendLoginAlert };
