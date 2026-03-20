const nodemailer = require("nodemailer");

// ✅ Explicit SMTP config — mas reliable kaysa service: "gmail"
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true para sa port 465, false para sa 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password (16 chars)
  },
  tls: {
    rejectUnauthorized: false, // ← fixes SSL issues sa localhost
  },
});

// ✅ I-verify ang connection pagka-start ng server
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
  } else {
    console.log("✅ Email server ready — Nodemailer connected!");
  }
});

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

function buildEmailHTML(firstName, link) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- HEADER -->
          <tr>
            <td style="background:#0B84FF;border-radius:20px 20px 0 0;padding:40px 32px;text-align:center;">
              <h1 style="color:#ffffff;font-size:28px;font-weight:700;margin:0 0 8px;">
                Verify Your Email
              </h1>
              <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">
                One click away from getting started
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:40px 32px;">
              <p style="color:#1e293b;font-size:18px;font-weight:600;margin:0 0 12px;">
                Hi ${firstName}! 👋
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 32px;">
                Thank you for registering with <strong style="color:#0B84FF;">AttendSure</strong>!
                Please verify your email address to activate your account.
              </p>

              <!-- VERIFY BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${link}"
                      style="display:inline-block;background:#0B84FF;
                             color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;
                             padding:18px 48px;border-radius:14px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;" />

              <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;
                        padding:12px 16px;font-size:12px;color:#0B84FF;
                        word-break:break-all;margin:0 0 28px;">
                ${link}
              </p>

              <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;">
                <p style="color:#92400e;font-size:13px;margin:0;line-height:1.6;">
                  ⚠️ <strong>This link expires in 1 hour.</strong>
                  If you did not create an account, ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;font-weight:600;">AttendSure Portal</p>
              <p style="color:#cbd5e1;font-size:12px;margin:0;">© ${new Date().getFullYear()} AttendSure. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendVerificationEmail(user, verificationToken) {
  const link = `${BASE_URL}/api/register/verify?token=${verificationToken}`;
  const html = buildEmailHTML(user.firstName, link);

  await transporter.sendMail({
    from: `"AttendSure" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Verify Your Email - AttendSure",
    html,
  });

  console.log("✅ Verification email sent to:", user.email);
  return { success: true };
}

async function sendResendVerificationEmail(user, verificationToken) {
  const link = `${BASE_URL}/api/register/verify?token=${verificationToken}`;
  const html = buildEmailHTML(user.firstName, link);

  await transporter.sendMail({
    from: `"AttendSure" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Verify Your Email - AttendSure",
    html,
  });

  console.log("✅ Resend email sent to:", user.email);
  return { success: true };
}

module.exports = { sendVerificationEmail, sendResendVerificationEmail };