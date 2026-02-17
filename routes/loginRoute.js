const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ UNIVERSAL LOGIN
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== LOGIN REQUEST ==========");
  console.log("📧 Email:", req.body.email);
  console.log("🔑 Has password:", !!req.body.password);

  try {
    const { email, password } = req.body;

    // 🔹 Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required" 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("🔍 Looking for user with email:", normalizedEmail);

    // 🔹 Find user by email (any role)
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log("❌ No user found with email:", normalizedEmail);
      return res.status(400).json({ 
        error: "Invalid email or password" 
      });
    }

    console.log("✅ User found:", user.firstName, user.lastName, "| Role:", user.role);
    console.log("🔑 Has stored password:", !!user.password);

    if (!user.password) {
      console.log("❌ User has no password - not yet registered");
      return res.status(400).json({ 
        error: "Account not fully registered. Please complete registration first." 
      });
    }

    // 🔹 Compare password with hashed password
    console.log("🔐 Comparing passwords...");
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔐 Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password does not match");
      return res.status(400).json({ 
        error: "Invalid email or password" 
      });
    }

    console.log("✅ Password matched!");

    // 🔹 Generate JWT token (valid for 7 days)
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role,
        email: user.email 
      },
      process.env.JWT_SECRET || "your_super_secret_key_here",
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // 🔹 Clean user data (remove sensitive fields)
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
    };

    console.log("✅ Login successful for:", user.email);
    console.log("🔵 =====================================\n");

    // ✅ Send success response
    res.status(200).json({
      success: true,
      message: "Login successful!",
      user: userInfo,
      token,
    });

  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ 
      error: "Server error during login" 
    });
  }
});

module.exports = router;