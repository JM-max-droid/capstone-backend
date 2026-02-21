const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/User");
const { sendVerificationEmail } = require("../../utils/emailService");

// ✅ POST /api/register
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== REGISTRATION REQUEST ==========");
  console.log("📧 Request body:", {
    idNumber: req.body.idNumber,
    email: req.body.email,
    hasPassword: !!req.body.password,
  });

  try {
    const { idNumber, email, password, photoURL, qrCode } = req.body;

    // ✅ Validation
    if (!idNumber || !email || !password) {
      console.log("❌ Validation failed: Missing required fields");
      return res.status(400).json({
        error: "ID, email, and password are required",
      });
    }

    // ✅ Find user by ID
    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) {
      console.log("❌ User not found with ID:", idNumber);
      return res.status(404).json({
        error: "User not found with that ID",
      });
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    // ✅ Check if already registered
    if (user.email && user.password) {
      console.log("❌ User already registered");
      return res.status(400).json({
        error: "This user is already registered",
      });
    }

    // ✅ Check if email is already used by another user
    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingEmail) {
      console.log("❌ Email already in use by another account");
      return res.status(400).json({
        error: "This email is already registered to another account",
      });
    }

    // ✅ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed successfully");

    // ✅ Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
    console.log("✅ Verification token generated");

    // ✅ Save user with token (bypass pre-save hook using updateOne)
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          isVerified: false,
          verificationToken,
          verificationTokenExpiry,
          ...(photoURL && { photoURL }),
          ...(qrCode && { qrCode }),
        },
      }
    );

    console.log("✅ User saved to database with verification token");

    // ✅ Fetch updated user
    const updatedUser = await User.findById(user._id);

    // ✅ Send verification email
    console.log("\n📧 ========== SENDING VERIFICATION EMAIL ==========");
    console.log("📬 To:", updatedUser.email);

    try {
      await sendVerificationEmail(updatedUser, verificationToken);
      console.log("✅ Verification email sent successfully");
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError);
      // Don't block registration even if email fails
      // Just log the error and continue
    }

    console.log("\n✅ ========== REGISTRATION SUCCESSFUL ==========");
    console.log("👤 User:", updatedUser.firstName, updatedUser.lastName);
    console.log("📧 Email:", updatedUser.email);
    console.log("🔑 Token saved, expires in 1 hour");
    console.log("===============================================\n");

    res.status(200).json({
      success: true,
      message: "✅ Registration successful! Please check your email to verify your account.",
      requiresVerification: true,
      email: email.trim().toLowerCase(),
    });

  } catch (err) {
    console.error("\n🔥 ========== REGISTRATION ERROR ==========");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("==========================================\n");

    res.status(500).json({
      error: "Server error during registration",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

module.exports = router;