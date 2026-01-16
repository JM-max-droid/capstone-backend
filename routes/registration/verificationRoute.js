// routes/registration/verificationRoute.js
const express = require("express");
const User = require("../../models/User");

const router = express.Router();

// ✅ GET /api/register/verify?token=xxxxx (for email link verification)
router.get("/", async (req, res) => {
  const { token } = req.query;
  
  console.log("📥 Verification request received with token:", token);
  
  if (!token) {
    return res.status(400).json({ 
      success: false,
      error: "Verification token is missing" 
    });
  }

  try {
    // Find user by verification code (token)
    const user = await User.findOne({ verificationCode: token });
    
    if (!user) {
      console.log("❌ No user found with token:", token);
      return res.status(404).json({ 
        success: false,
        error: "Invalid or expired verification link" 
      });
    }

    // Check if already verified
    if (user.isVerified) {
      console.log("ℹ️ Email already verified for:", user.email);
      return res.json({ 
        success: true,
        message: "Email already verified",
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        }
      });
    }

    // ✅ Verify the user
    user.isVerified = true;
    user.verificationCode = null; // Remove code after verification
    await user.save();

    console.log("✅ Email verified successfully for:", user.email);

    res.json({ 
      success: true,
      message: "Email verified successfully! You can now login to your account.",
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).json({ 
      success: false,
      error: "Server error during verification. Please try again." 
    });
  }
});

module.exports = router;