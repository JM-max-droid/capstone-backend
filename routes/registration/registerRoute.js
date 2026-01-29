const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/User");
const { sendVerificationEmail } = require("../../utils/emailService");

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

    // 📧 SEND VERIFICATION EMAIL using SendGrid HTTP API
    console.log("\n📧 ========== SENDING EMAIL ==========");
    console.log("📬 To:", user.email);
    
    try {
      await sendVerificationEmail(user, verificationToken);
      
      console.log("\n✅ ========== EMAIL SENT SUCCESSFULLY ==========");
      console.log("📧 Email sent to:", user.email);
      console.log("================================================\n");

    } catch (emailError) {
      console.error("\n❌ ========== EMAIL SENDING FAILED ==========");
      console.error("📧 Failed to send email to:", user.email);
      console.error("🔥 Error details:", emailError);
      
      if (emailError.response) {
        console.error("📮 SendGrid response:", emailError.response.body);
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