const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ UNIVERSAL LOGIN WITH EMAIL VERIFICATION CHECK
router.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔹 Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required" 
      });
    }

    // 🔹 Find user by email (any role)
    const user = await User.findOne({ 
      email: email.trim().toLowerCase() 
    });

    if (!user || !user.password) {
      return res.status(400).json({ 
        error: "Invalid email or password" 
      });
    }

    // 🔹 Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        error: "Invalid email or password" 
      });
    }

    // 🔒 CHECK IF EMAIL IS VERIFIED
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false,
        error: "Please verify your email before logging in. Check your inbox for the verification link.",
        requiresVerification: true,
        email: user.email,
      });
    }

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
      isVerified: user.isVerified,
    };

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