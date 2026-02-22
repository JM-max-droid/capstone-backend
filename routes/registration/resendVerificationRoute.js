const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../../models/User");
const { sendResendVerificationEmail } = require("../../utils/emailService");

// ✅ POST /api/register/resend-verification
router.post("/", async (req, res) => {
  console.log("\n🔵 ========== RESEND VERIFICATION REQUEST ==========");

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, error: "No account found with this email" });
    }

    console.log("✅ User found:", user.firstName, user.lastName);
    console.log("📊 isEmailVerified:", user.isEmailVerified);

    // ⚠️ Already verified
    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: "Email is already verified. You can login now.",
      });
    }

    // ✅ Generate new token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // ✅ Use updateOne — bypasses mongoose validation (no required field errors)
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          verificationToken,
          verificationTokenExpiry,
        },
      }
    );

    console.log("✅ New token saved via updateOne");

    // ✅ Send email
    try {
      await sendResendVerificationEmail(user, verificationToken);
      console.log("✅ Resend email sent to:", user.email);
    } catch (emailError) {
      console.error("❌ Failed to resend email:", emailError.message);
      return res.status(500).json({
        success: false,
        error: "Failed to send verification email. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Verification email has been resent. Please check your inbox.",
    });

  } catch (err) {
    console.error("🔥 Resend error:", err);
    res.status(500).json({ success: false, error: "Failed to resend verification email" });
  }
});

module.exports = router;