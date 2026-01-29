const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../../models/User");

// ✅ SENDGRID EMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY,
  },
});

// 🔍 VERIFY SENDGRID CONNECTION ON STARTUP
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SendGrid connection FAILED:", error);
    console.error("⚠️  Check if SENDGRID_API_KEY is set in environment variables");
  } else {
    console.log("✅ SendGrid is ready to send emails");
  }
});

// ✅ POST REGISTRATION WITH EMAIL VERIFICATION
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== REGISTRATION REQUEST ==========");
  console.log("📧 Request body:", {
    idNumber: req.body.idNumber,
    email: req.body.email,
    hasPassword: !!req.body.password,
  });

  try {
    const { idNumber, email, password, photoURL, qrCode } = req.body;

    // Validation
    if (!idNumber || !email || !password) {
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({ 
        error: "ID, email, and password are required" 
      });
    }

    // Find user by ID
    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) {
      console.log("❌ User not found with ID:", idNumber);
      return res.status(404).json({ 
        error: "User not found with that ID" 
      });
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    // Check if already registered
    if (user.email && user.password) {
      console.log("❌ User already registered");
      return res.status(400).json({ 
        error: "This user is already registered" 
      });
    }

    // Check if email is already used by another user
    const existingEmail = await User.findOne({ 
      email: email.trim().toLowerCase(),
      _id: { $ne: user._id }
    });
    if (existingEmail) {
      console.log("❌ Email already in use by another account");
      return res.status(400).json({ 
        error: "This email is already registered to another account" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed successfully");

    // 🔑 GENERATE VERIFICATION TOKEN
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    console.log("✅ Verification token generated");
    console.log("🔗 Token:", verificationToken.substring(0, 20) + "...");

    // Update user
    user.email = email.trim().toLowerCase();
    user.password = hashedPassword;
    user.isVerified = false;
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    
    if (photoURL) user.photoURL = photoURL;
    if (qrCode) user.qrCode = qrCode;

    await user.save();
    console.log("✅ User data saved to database (isVerified: false)");

    // 📧 SEND VERIFICATION EMAIL
    const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;
    
    console.log("\n📧 ========== SENDING EMAIL ==========");
    console.log("📬 To:", user.email);
    console.log("🔗 Verification link:", verificationLink);
    
    const mailOptions = {
      from: 'attendsure6@gmail.com',
      to: user.email,
      subject: "Verify Your Email - AttendSure Portal",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                        🎉 Welcome to AttendSure!
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="margin: 0 0 20px; color: #1E293B; font-size: 22px; font-weight: 600;">
                        Hi ${user.firstName}!
                      </h2>
                      
                      <p style="margin: 0 0 20px; color: #64748B; font-size: 16px; line-height: 1.6;">
                        Thank you for registering! We're excited to have you on board. 
                        To complete your registration and access your account, please verify your email address.
                      </p>
                      
                      <p style="margin: 0 0 30px; color: #64748B; font-size: 16px; line-height: 1.6;">
                        Click the button below to verify your email:
                      </p>
                      
                      <!-- Button -->
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
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="margin: 10px 0 0; color: #0B84FF; font-size: 14px; word-break: break-all;">
                        ${verificationLink}
                      </p>
                      
                      <div style="margin-top: 30px; padding: 20px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px;">
                        <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
                          ⚠️ <strong>Important:</strong> This verification link will expire in 1 hour.
                        </p>
                      </div>
                      
                      <p style="margin: 30px 0 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                        If you didn't create this account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
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

    try {
      console.log("📤 Attempting to send email via SendGrid...");
      const info = await transporter.sendMail(mailOptions);
      
      console.log("\n✅ ========== EMAIL SENT SUCCESSFULLY ==========");
      console.log("📧 Email sent to:", user.email);
      console.log("📨 Message ID:", info.messageId);
      console.log("✉️  Response:", info.response);
      console.log("================================================\n");

    } catch (emailError) {
      console.error("\n❌ ========== EMAIL SENDING FAILED ==========");
      console.error("📧 Failed to send email to:", user.email);
      console.error("🔥 Error details:", emailError);
      
      if (emailError.response) {
        console.error("📮 SendGrid response:", emailError.response);
      }
      if (emailError.code) {
        console.error("🔢 Error code:", emailError.code);
      }
      
      console.error("================================================\n");

      // Rollback user registration if email fails
      console.log("🔄 Rolling back registration...");
      user.email = undefined;
      user.password = undefined;
      user.verificationToken = undefined;
      user.verificationTokenExpiry = undefined;
      user.isVerified = false;
      await user.save();
      console.log("✅ User data rolled back");
      
      return res.status(500).json({ 
        error: "Failed to send verification email. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    // ✅ SUCCESS RESPONSE
    const userInfo = {
      idNumber: user.idNumber,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      age: user.age,
      course: user.course,
      strand: user.strand,
      yearLevel: user.yearLevel,
      section: user.section,
      sscPosition: user.sscPosition,
      email: user.email,
      photoURL: user.photoURL || null,
      qrCode: user.qrCode || null,
      role: user.role,
      isVerified: user.isVerified,
    };

    console.log("✅ Registration successful - email verification required");
    console.log("🔵 ========================================\n");

    res.status(200).json({
      success: true,
      message: "✅ Registration successful! Please check your email to verify your account.",
      user: userInfo,
      requiresVerification: true,
    });

  } catch (err) {
    console.error("\n🔥 ========== REGISTRATION ERROR ==========");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("==========================================\n");
    
    res.status(500).json({ 
      error: "Server error during registration",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;