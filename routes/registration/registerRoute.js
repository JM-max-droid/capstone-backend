const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/User");
const { sendVerificationEmail } = require("../../utils/emailService");

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

    // ✅ Save to DB
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

    console.log("✅ User saved to DB successfully");

    // ✅ Build updated user object — HINDI na yung lumang 'user' variable
    // Kaya nagfa-fail dati: user.email ay undefined pa noon bago ang updateOne()
    const updatedUser = {
      ...user.toObject(),
      email: email.trim().toLowerCase(),
      firstName: user.firstName,
    };

    // ✅ Send verification email gamit ang UPDATED user
    console.log("📧 Sending verification email to:", updatedUser.email);
    await sendVerificationEmail(updatedUser, verificationToken);
    console.log("✅ Verification email sent successfully!");

    res.status(200).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
      email: email.trim().toLowerCase(),
    });

  } catch (err) {
    console.error("🔥 Registration error:", err.message);

    // ✅ Mas specific na error messages
    if (err.message.includes("EAUTH") || err.message.includes("535")) {
      return res.status(500).json({ error: "Email authentication failed. Please contact support." });
    }
    if (err.message.includes("ECONNECTION") || err.message.includes("ETIMEDOUT")) {
      return res.status(500).json({ error: "Cannot connect to email server. Please try again." });
    }

    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;