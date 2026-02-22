const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

console.log("✅ Resend email service initialized");

async function sendVerificationEmail(user, verificationToken) {
  const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: "AttendSure <onboarding@resend.dev>",
      to: user.email,
      subject: "Verify Your Email - AttendSure Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
                <tr>
                  <td style="background:linear-gradient(135deg,#0B84FF,#0073E6);padding:40px 30px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">🎉 Welcome to AttendSure!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 30px;">
                    <h2 style="margin:0 0 20px;color:#1E293B;font-size:22px;">Hi ${user.firstName}!</h2>
                    <p style="margin:0 0 20px;color:#64748B;font-size:16px;line-height:1.6;">
                      Thank you for registering! Please verify your email to complete your registration.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:20px 0;">
                          <a href="${verificationLink}"
                             style="display:inline-block;background:linear-gradient(135deg,#0B84FF,#0073E6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:600;">
                            ✅ Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:20px 0 5px;color:#94A3B8;font-size:14px;">Or copy this link:</p>
                    <p style="margin:0;color:#0B84FF;font-size:14px;word-break:break-all;">${verificationLink}</p>
                    <div style="margin-top:30px;padding:20px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;">
                      <p style="margin:0;color:#92400E;font-size:14px;">⚠️ <strong>Important:</strong> This link expires in 1 hour.</p>
                    </div>
                    <p style="margin:20px 0 0;color:#64748B;font-size:14px;">If you didn't create this account, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#F8FAFC;padding:30px;text-align:center;border-top:1px solid #E2E8F0;">
                    <p style="margin:0;color:#94A3B8;font-size:13px;">AttendSure Portal © 2025 — Automated email. Do not reply.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Resend error (sendVerificationEmail):", error);
      throw new Error(error.message);
    }

    console.log("✅ Verification email sent to:", user.email, "| ID:", data.id);
    return { success: true };

  } catch (err) {
    console.error("❌ Failed to send verification email:", err.message);
    throw err;
  }
}

async function sendResendVerificationEmail(user, verificationToken) {
  const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: "AttendSure <onboarding@resend.dev>",
      to: user.email,
      subject: "Resend: Verify Your Email - AttendSure Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1);">
                <tr>
                  <td style="background:linear-gradient(135deg,#0B84FF,#0073E6);padding:40px 30px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700;">🔁 Verification Link Resent</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 30px;">
                    <h2 style="margin:0 0 20px;color:#1E293B;font-size:22px;">Hi ${user.firstName}!</h2>
                    <p style="margin:0 0 30px;color:#64748B;font-size:16px;line-height:1.6;">
                      You requested a new verification link. Click the button below:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding:20px 0;">
                          <a href="${verificationLink}"
                             style="display:inline-block;background:linear-gradient(135deg,#0B84FF,#0073E6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:600;">
                            ✅ Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:20px 0 5px;color:#94A3B8;font-size:14px;">Or copy this link:</p>
                    <p style="margin:0;color:#0B84FF;font-size:14px;word-break:break-all;">${verificationLink}</p>
                    <div style="margin-top:30px;padding:20px;background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;">
                      <p style="margin:0;color:#92400E;font-size:14px;">⚠️ <strong>Important:</strong> This link expires in 1 hour.</p>
                    </div>
                    <p style="margin:20px 0 0;color:#64748B;font-size:14px;">If you didn't request this, ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#F8FAFC;padding:30px;text-align:center;border-top:1px solid #E2E8F0;">
                    <p style="margin:0;color:#94A3B8;font-size:13px;">AttendSure Portal © 2025 — Automated email. Do not reply.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("❌ Resend error (sendResendVerificationEmail):", error);
      throw new Error(error.message);
    }

    console.log("✅ Resend verification email sent to:", user.email, "| ID:", data.id);
    return { success: true };

  } catch (err) {
    console.error("❌ Failed to resend verification email:", err.message);
    throw err;
  }
}

module.exports = { sendVerificationEmail, sendResendVerificationEmail };