const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

router.post("/", async (req, res) => {
  console.log("\n🔵 ========== LOGIN REQUEST ==========");
  console.log("📧 Email:", req.body.email);

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    console.log("✅ User found:", user.firstName, user.lastName, "| Role:", user.role);

    if (!user.password) {
      return res.status(400).json({
        error: "Account not fully registered. Please complete registration first.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    console.log("✅ Password matched!");

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "your_super_secret_key_here",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const userInfo = {
      id: user._id,
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
      isEmailVerified: user.isEmailVerified,
    };

    console.log("✅ Login successful:", user.email);
    console.log("🔵 =====================================\n");

    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: userInfo,
      token,
    });

  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;