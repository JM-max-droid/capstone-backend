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

    if (!idNumber || !email || !password) {
      return res.status(400).json({ error: "ID, email, and password are required" });
    }

    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) {
      return res.status(404).json({ error: "User not found with that ID" });
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    if (user.email && user.password) {
      return res.status(400).json({ error: "This user is already registered" });
    }

    const existingEmail = await User.findOne({
      email: email.trim().toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingEmail) {
      return res.status(400).json({ error: "This email is already registered to another account" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // ✅ Use updateOne to bypass pre-save hook (avoid double hashing)
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          isEmailVerified: false,
          verificationToken,
          verificationTokenExpiry,
          ...(photoURL && { photoURL }),
          ...(qrCode && { qrCode }),
        },
      }
    );

    console.log("✅ User saved with verification token");

    const updatedUser = await User.findById(user._id);

    // ✅ Send verification email
    try {
      await sendVerificationEmail(updatedUser, verificationToken);
      console.log("✅ Verification email sent to:", updatedUser.email);
    } catch (emailError) {
      console.error("❌ Failed to send verification email:", emailError.message);
    }

    res.status(200).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
      requiresVerification: true,
      email: email.trim().toLowerCase(),
    });

  } catch (err) {
    console.error("🔥 Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;