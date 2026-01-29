const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../../models/User");
const { sendResendVerificationEmail } = require("../../utils/emailService");

// 🔁 POST /api/register/resend-verification
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== RESEND VERIFICATION REQUEST ==========");
  
  try {
    const { email } = req.body;

    console.log("📧 Email from request:", email);

    if (!email) {
      console.log("❌ No email provided");
      return res.status(400).json({ 
        success: false,
        error: "Email is required" 
      });
    }

    // Find user
    console.log("🔍 Searching for user with email:", email.trim().toLowerCase());
    const user = await User.findOne({ 
      email: email.trim().toLowerCase() 
    });

    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ 
        success: false,
        error: "No account found with this email" 
      });
    }

    console.log("✅ User found:", user.firstName, user.lastName);
    console.log("📊 Current status - isVerified:", user.isVerified);

    // Already verified
    if (user.isVerified) {
      console.log("⚠️  User already verified");
      return res.status(200).json({ 
        success: true,
        message: "Email is already verified. You can login now." 
      });
    }

    // Generate new token
    console.log("🔑 Generating new verification token...");
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    console.log("✅ New token saved to database");
    console.log("🔗 Token:", verificationToken.substring(0, 20) + "...");
    console.log("⏰ Expires:", new Date(verificationTokenExpiry).toISOString());

    // Send email using SendGrid HTTP API
    console.log("\n📧 ========== RESENDING EMAIL ==========");
    console.log("📬 To:", user.email);
    
    try {
      await sendResendVerificationEmail(user, verificationToken);
      
      console.log("\n✅ ========== EMAIL RESENT SUCCESSFULLY ==========");
      console.log("📧 Email sent to:", user.email);
      console.log("=================================================\n");

    } catch (emailError) {
      console.error("\n❌ ========== EMAIL RESEND FAILED ==========");
      console.error("📧 Failed to resend email to:", user.email);
      console.error("🔥 Error details:", emailError);
      
      if (emailError.response) {
        console.error("📮 SendGrid response:", emailError.response.body);
      }
      
      console.error("============================================\n");

      return res.status(500).json({ 
        success: false,
        error: "Failed to send verification email. Please try again later.",
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
      });
    }

    console.log("✅ Resend verification successful");
    console.log("🔵 ===========================================\n");

    res.status(200).json({
      success: true,
      message: "Verification email has been resent. Please check your inbox.",
    });

  } catch (err) {
    console.error("\n🔥 ========== RESEND ERROR ==========");
    console.error("Error:", err);
    console.error("Stack:", err.stack);
    console.error("=====================================\n");
    
    res.status(500).json({ 
      success: false,
      error: "Failed to resend verification email",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;