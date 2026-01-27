const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../../models/User");

// ✅ EMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// ✅ VERIFICATION LINK GENERATOR
const getVerificationLink = (token) => {
  // For production (deployed backend):
  if (process.env.NODE_ENV === 'production' || process.env.FRONTEND_URL) {
    // Deep link format for mobile app
    return `myapp://verify-email?token=${token}`;
  }
  
  // For development (Expo Go):
  // Change this to your local IP during development
  return `exp://192.168.1.100:8081/--/verify-email?token=${token}`;
};

// 🔁 POST /api/register/resend-verification
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: "Email is required" 
      });
    }

    // Find user
    const user = await User.findOne({ 
      email: email.trim().toLowerCase() 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: "No account found with this email" 
      });
    }

    // Already verified
    if (user.isVerified) {
      return res.status(200).json({ 
        success: true,
        message: "Email is already verified. You can login now." 
      });
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    // Send email
    const verificationLink = getVerificationLink(verificationToken);
    
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: "Resend: Verify Your Email - AttendSure Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                        🔁 Verification Link Resent
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="margin: 0 0 20px; color: #1E293B; font-size: 22px; font-weight: 600;">
                        Hi ${user.firstName}!
                      </h2>
                      <p style="margin: 0 0 30px; color: #64748B; font-size: 16px; line-height: 1.6;">
                        You requested a new verification link. Click the button below to verify your email:
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="${verificationLink}" 
                               style="display: inline-block; background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); 
                                      color: #ffffff; text-decoration: none; padding: 16px 40px; 
                                      border-radius: 12px; font-size: 16px; font-weight: 600;
                                      box-shadow: 0 4px 12px rgba(11, 132, 255, 0.3);">
                              ✅ Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 30px 0 0; color: #94A3B8; font-size: 14px; line-height: 1.6;">
                        Or copy and paste this link:
                      </p>
                      <p style="margin: 10px 0 0; color: #0B84FF; font-size: 14px; word-break: break-all;">
                        ${verificationLink}
                      </p>
                      <div style="margin-top: 30px; padding: 20px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px;">
                        <p style="margin: 0; color: #92400E; font-size: 14px;">
                          ⚠️ <strong>Important:</strong> This link will expire in 1 hour.
                        </p>
                      </div>
                      <p style="margin: 30px 0 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                        If you didn't request this, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                      <p style="margin: 0 0 10px; color: #94A3B8; font-size: 13px;">
                        AttendSure Portal © 2025
                      </p>
                      <p style="margin: 0; color: #CBD5E1; font-size: 12px;">
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Verification email resent to:", user.email);

    res.status(200).json({
      success: true,
      message: "Verification email has been resent. Please check your inbox.",
    });

  } catch (err) {
    console.error("🔥 Resend Verification Error:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to resend verification email" 
    });
  }
});

module.exports = router;