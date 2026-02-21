const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// ✅ GET /api/register/verify?token=xxx
router.get("/", async (req, res) => {
  console.log("\n🔵 ========== VERIFICATION REQUEST ==========");

  try {
    const { token } = req.query;
    console.log("🔑 Token received:", token ? token.substring(0, 20) + "..." : "NONE");

    if (!token) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Failed</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);text-align:center}.i{font-size:64px;margin-bottom:20px}h1{color:#1e293b;font-size:28px;margin:0 0 15px}p{color:#64748b;font-size:16px;line-height:1.6;margin:0}</style></head><body><div class="c"><div class="i">❌</div><h1>Missing Token</h1><p>Invalid verification link. Please check your email and try again.</p></div></body></html>`);
    }

    // 🔍 Find user with valid non-expired token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      console.log("❌ Token invalid or expired");
      const expiredUser = await User.findOne({ verificationToken: token });
      if (expiredUser) console.log("⚠️ Expired for:", expiredUser.email);
      else console.log("⚠️ Token not in DB");

      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Expired</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);text-align:center}.i{font-size:64px;margin-bottom:20px}h1{color:#1e293b;font-size:28px;margin:0 0 15px}p{color:#64748b;font-size:16px;line-height:1.6;margin:0 0 10px}.wb{background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:15px;margin-top:20px;text-align:left}.wb p{color:#92400e;font-size:14px;margin:0}</style></head><body><div class="c"><div class="i">⏰</div><h1>Link Expired</h1><p>This verification link is invalid or has expired.</p><div class="wb"><p><strong>⚠️ Note:</strong> Links expire after 1 hour. Please request a new one from the app.</p></div></div></body></html>`);
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    // ⚠️ Already verified
    if (user.isEmailVerified) {
      console.log("⚠️ Already verified");
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Already Verified</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#0B84FF,#0073E6);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);text-align:center}.i{font-size:64px;margin-bottom:20px}h1{color:#1e293b;font-size:28px;margin:0 0 15px}p{color:#64748b;font-size:16px;line-height:1.6;margin:0}.sb{background:#d1fae5;border-left:4px solid #10b981;border-radius:8px;padding:15px;margin-top:20px;text-align:left}.sb p{color:#065f46;font-size:14px;margin:0}</style></head><body><div class="c"><div class="i">✅</div><h1>Already Verified</h1><p>Your email has already been verified.</p><div class="sb"><p><strong>✓ You're all set!</strong> You can now login to your AttendSure account.</p></div></div></body></html>`);
    }

    // ✅ Verify the user
    await User.updateOne(
      { _id: user._id },
      {
        $set: { isEmailVerified: true },
        $unset: { verificationToken: "", verificationTokenExpiry: "" },
      }
    );

    console.log("\n✅ ========== EMAIL VERIFIED ==========");
    console.log("👤", user.firstName, user.lastName, "| 📧", user.email);
    console.log("======================================\n");

    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Verified</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#0B84FF,#0073E6);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.2);text-align:center;animation:s .5s ease-out}@keyframes s{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.i{font-size:80px;margin-bottom:20px}h1{color:#1e293b;font-size:32px;margin:0 0 15px;font-weight:700}.w{color:#0B84FF;font-size:20px;font-weight:600;margin:0 0 20px}p{color:#64748b;font-size:16px;line-height:1.6;margin:0 0 10px}.sb{background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:12px;padding:20px;margin-top:25px;text-align:left}.sb p{color:#065f46;font-size:15px;margin:0}.f{margin-top:30px;padding-top:20px;border-top:1px solid #e2e8f0}.f p{color:#94a3b8;font-size:13px}</style></head><body><div class="c"><div class="i">🎉</div><h1>Email Verified!</h1><p class="w">Welcome, ${user.firstName}!</p><p>Your email has been successfully verified.</p><div class="sb"><p><strong>✓ What's Next?</strong></p><p style="margin-top:10px">You can now login to your AttendSure account and start using all features.</p></div><div class="f"><p>AttendSure Portal © 2025</p><p style="font-size:12px">You can close this window now.</p></div></div></body></html>`);

  } catch (err) {
    console.error("🔥 Verification error:", err);
    return res.status(500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title><style>body{font-family:-apple-system,sans-serif;background:linear-gradient(135deg,#ef4444,#dc2626);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.c{background:#fff;border-radius:16px;padding:40px;max-width:500px;width:100%;text-align:center}.i{font-size:64px;margin-bottom:20px}h1{color:#1e293b}p{color:#64748b}</style></head><body><div class="c"><div class="i">💥</div><h1>Server Error</h1><p>Something went wrong. Please try again later.</p></div></body></html>`);
  }
});

module.exports = router;