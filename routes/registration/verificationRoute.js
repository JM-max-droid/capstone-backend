// routes/registration/verificationRoute.js
const express = require("express");  // ← Changed to require
const User = require("../../models/User"); // ← Changed to require

const router = express.Router();

// POST /api/register/verify
router.post("/", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing fields" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.verificationCode !== code)
      return res.status(400).json({ error: "Invalid verification code" });

    user.isVerified = true;
    user.verificationCode = null; // Remove code after verification
    await user.save();

    res.json({ message: "✅ Email verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;  // ← Changed to module.exports