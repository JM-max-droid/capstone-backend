const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

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

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          isEmailVerified: true,
          ...(photoURL && { photoURL }),
          ...(qrCode && { qrCode }),
        },
      }
    );

    console.log("✅ User registered successfully");

    res.status(200).json({
      success: true,
      message: "Registration successful! You can now login.",
      email: email.trim().toLowerCase(),
    });

  } catch (err) {
    console.error("🔥 Registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;