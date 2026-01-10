const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ UNIVERSAL LOGIN (works for all roles)
router.post("/", async (req, res) => {
  const { email, password } = req.body;

  // 🔹 Validate input
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });

  try {
    // 🔹 Find user by email (any role)
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user)
      return res.status(400).json({ error: "Invalid email or password" });

    // 🔹 Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch)
      return res.status(400).json({ error: "Invalid email or password" });

    // 🔹 Generate JWT token (valid for 7 days)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "default_secret_key", // ✅ use a real secret key in production
      { expiresIn: "7d" }
    );

    // 🔹 Clean data (omit password)
    const { password: _, ...userInfo } = user._doc;

    // ✅ Send user info + token
    res.status(200).json({
      message: "Login successful",
      user: userInfo,
      token,
    });
  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

module.exports = router;
