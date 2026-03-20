const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// SVG Icons
const iconSuccess = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`;
const iconExpired = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const iconError = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
const iconAlready = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#0B84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`;
const iconServerError = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 21 2 21"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const baseStyle = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:linear-gradient(135deg,#0B84FF,#0066CC);margin:0;padding:20px;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .c{background:#fff;border-radius:24px;padding:40px 32px;max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);text-align:center;animation:fadeUp .4s ease-out}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  .icon{margin-bottom:24px}
  h1{color:#1e293b;font-size:26px;font-weight:700;margin:0 0 12px}
  p{color:#64748b;font-size:15px;line-height:1.7;margin:0 0 12px}
  .badge{border-radius:10px;padding:14px 16px;margin-top:20px;text-align:left;font-size:13px;line-height:1.6}
  .badge.green{background:#d1fae5;border-left:4px solid #10b981}.badge.green p{color:#065f46;margin:0}
  .badge.yellow{background:#fef3c7;border-left:4px solid #f59e0b}.badge.yellow p{color:#92400e;margin:0}
  .badge.blue{background:#dbeafe;border-left:4px solid #0B84FF}.badge.blue p{color:#1e40af;margin:0}
  .footer{margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0}
  .footer p{color:#94a3b8;font-size:12px;margin:0}
`;

// ✅ GET /api/register/verify?token=xxx
router.get("/", async (req, res) => {
  console.log("\n🔵 ========== VERIFICATION REQUEST ==========");

  try {
    const { token } = req.query;
    console.log("🔑 Token received:", token ? token.substring(0, 20) + "..." : "NONE");

    if (!token) {
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invalid Link</title><style>${baseStyle}</style></head><body><div class="c"><div class="icon">${iconError}</div><h1>Missing Token</h1><p>Invalid verification link. Please check your email and try again.</p></div></body></html>`);
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });

    if (!user) {
      console.log("❌ Token invalid or expired");
      const expiredUser = await User.findOne({ verificationToken: token });
      if (expiredUser) console.log("⚠️ Expired for:", expiredUser.email);
      else console.log("⚠️ Token not in DB");

      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired</title><style>${baseStyle}</style></head><body><div class="c"><div class="icon">${iconExpired}</div><h1>Link Expired</h1><p>This verification link is invalid or has expired.</p><div class="badge yellow"><p><strong>Note:</strong> Links expire after 24 hours. Please request a new one from the app.</p></div></div></body></html>`);
    }

    console.log("✅ User found:", user.firstName, user.lastName);

    if (user.isEmailVerified) {
      console.log("⚠️ Already verified");
      return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Already Verified</title><style>${baseStyle}</style></head><body><div class="c"><div class="icon">${iconAlready}</div><h1>Already Verified</h1><p>Your email has already been verified.</p><div class="badge blue"><p><strong>You're all set!</strong> You can now login to your AttendSure account.</p></div><div class="footer"><p>AttendSure &copy; ${new Date().getFullYear()}</p></div></div></body></html>`);
    }

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

    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Verified</title><style>${baseStyle}</style></head><body><div class="c"><div class="icon">${iconSuccess}</div><h1>Email Verified!</h1><p class="welcome" style="color:#0B84FF;font-size:18px;font-weight:600;margin-bottom:8px;">Welcome, ${user.firstName}!</p><p>Your email has been successfully verified.</p><div class="badge green"><p><strong>What's Next?</strong> You can now login to your AttendSure account and start using all features.</p></div><div class="footer"><p>AttendSure &copy; ${new Date().getFullYear()} &mdash; You can close this window now.</p></div></div></body></html>`);

  } catch (err) {
    console.error("🔥 Verification error:", err);
    return res.status(500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title><style>${baseStyle}</style></head><body><div class="c"><div class="icon">${iconServerError}</div><h1>Server Error</h1><p>Something went wrong. Please try again later.</p></div></body></html>`);
  }
});

module.exports = router;