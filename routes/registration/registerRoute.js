const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../../models/User");

// 📧 Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// 📧 Send Verification Email Function
const sendVerificationEmail = async (email, verificationToken, userName) => {
  // ✅ FIXED: Changed to match your app.js route: /api/register/verify
  const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;
  
  const mailOptions = {
    from: '"AttendSure" <' + process.env.GMAIL_USER + '>',
    to: email,
    subject: 'Verify Your Email - AttendSure',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header with Logo -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); padding: 40px 20px; text-align: center;">
                    <div style="width: 80px; height: 80px; background-color: #fff; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      <span style="font-size: 40px; font-weight: 700; color: #0B84FF;">A</span>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Verify Your Email</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 24px; margin: 0 0 20px 0;">
                      Hi <strong>${userName}</strong>,
                    </p>
                    <p style="color: #666666; font-size: 15px; line-height: 24px; margin: 0 0 30px 0;">
                      Thank you for registering with <strong>AttendSure</strong>! Please verify your email address by clicking the button below:
                    </p>
                    
                    <!-- Verification Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${verificationLink}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(11, 132, 255, 0.3);">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #666666; font-size: 14px; line-height: 22px; margin: 30px 0 0 0;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="color: #0B84FF; font-size: 13px; word-break: break-all; margin: 10px 0 0 0;">
                      ${verificationLink}
                    </p>
                    
                    <!-- Info Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background-color: #EFF6FF; border-radius: 8px; padding: 15px;">
                      <tr>
                        <td>
                          <p style="color: #1E40AF; font-size: 13px; line-height: 20px; margin: 0;">
                            ⏰ <strong>Note:</strong> This verification link will expire in 24 hours.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #e9ecef;">
                    <p style="color: #6c757d; font-size: 12px; line-height: 18px; margin: 0 0 10px 0;">
                      If you didn't create an account, please ignore this email.
                    </p>
                    <p style="color: #6c757d; font-size: 12px; line-height: 18px; margin: 0;">
                      © 2025 AttendSure. All rights reserved.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

// ✅ POST registration (WITH EMAIL VERIFICATION)
router.post("/", async (req, res) => {
  try {
    const { idNumber, email, password, photoURL, qrCode } = req.body;
    if (!idNumber || !email || !password)
      return res.status(400).json({ error: "ID, email, and password are required" });

    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) return res.status(404).json({ error: "User not found with that ID" });

    if (user.email && user.password)
      return res.status(400).json({ error: "This user is already registered" });

    // 🔐 Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    const hashedPassword = await bcrypt.hash(password, 10);
    user.email = email.trim().toLowerCase();
    user.password = hashedPassword;
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    user.isVerified = false;
    if (photoURL) user.photoURL = photoURL;
    if (qrCode) user.qrCode = qrCode;

    await user.save();

    // 📧 Send verification email
    try {
      await sendVerificationEmail(
        user.email, 
        verificationToken, 
        `${user.firstName} ${user.lastName}`
      );
      console.log("✅ Verification email sent to:", user.email);
    } catch (emailError) {
      console.error("📧 Email sending failed:", emailError);
      // Rollback the user if email fails
      user.email = undefined;
      user.password = undefined;
      user.verificationToken = undefined;
      user.verificationTokenExpiry = undefined;
      user.isVerified = false;
      await user.save();
      
      return res.status(500).json({ 
        error: "Failed to send verification email. Please try again." 
      });
    }

    const userInfo = {
      idNumber: user.idNumber,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      course: user.course,
      yearLevel: user.yearLevel,
      section: user.section,
      email: user.email,
      photoURL: user.photoURL || null,
      qrCode: user.qrCode || null,
      role: user.role,
      isVerified: user.isVerified,
    };

    res.status(200).json({ 
      message: "✅ Registration successful! Please check your email to verify your account.", 
      user: userInfo 
    });
  } catch (err) {
    console.error("🔥 Registration Error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;