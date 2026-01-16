// routes/registration/verificationRoute.js
const express = require("express");
const User = require("../../models/User");

const router = express.Router();

// GET /api/register/verify?token=xxxxx (for email link verification)
router.get("/", async (req, res) => {
  const { token } = req.query;
  
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
      return res.status(404).json({ 
        success: false,
        error: "Invalid or expired verification link" 
      });
    }

    if (user.isVerified) {
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

    // Verify the user
    user.isVerified = true;
    user.verificationCode = null; // Remove code after verification
    await user.save();

    console.log("✅ Email verified successfully for:", user.email);

    res.json({ 
      success: true,
      message: "Email verified successfully",
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
      error: "Server error during verification" 
    });
  }
});

module.exports = router;