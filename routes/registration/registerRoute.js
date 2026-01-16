const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../../models/User");

// ✅ POST registration (WITHOUT EMAIL VERIFICATION)
router.post("/", async (req, res) => {
  try {
    const { idNumber, email, password, photoURL, qrCode } = req.body;
    if (!idNumber || !email || !password)
      return res.status(400).json({ error: "ID, email, and password are required" });

    const user = await User.findOne({ idNumber: Number(idNumber) });
    if (!user) return res.status(404).json({ error: "User not found with that ID" });

    if (user.email && user.password)
      return res.status(400).json({ error: "This user is already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.email = email.trim().toLowerCase();
    user.password = hashedPassword;
    if (photoURL) user.photoURL = photoURL;
    if (qrCode) user.qrCode = qrCode;

    await user.save();

    const userInfo = {
      idNumber: user.idNumber,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      course: user.course,
      yearLevel: user.yearLevel,
      section: user.section,
      email: user.email,
      photoURL: user.photoURL || null,
      qrCode: user.qrCode || null,
      role: user.role,
    };

    res.status(200).json({ 
      message: "✅ Registration successful! You can now login to your account.", 
      user: userInfo 
    });
  } catch (err) {
    console.error("🔥 Registration Error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

module.exports = router;