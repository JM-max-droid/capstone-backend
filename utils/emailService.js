const https = require("https");

function sendEmail({ to, subject, html }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from: "AttendSure <onboarding@resend.dev>", to: [to], subject, html });
    const options = {
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) { resolve(parsed); }
          else { reject(new Error("Resend error: " + data)); }
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

async function sendVerificationEmail(user, verificationToken) {
  const link = "https://capstone-backend-hk0h.onrender.com/api/register/verify?token=" + verificationToken;
  const html = "<h2>Hi " + user.firstName + "!</h2><p>Click to verify your email:</p><a href='" + link + "' style='background:#0B84FF;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;display:inline-block;'>Verify Email Address</a><p>Or copy: " + link + "</p><p><strong>Expires in 1 hour.</strong></p>";
  const result = await sendEmail({ to: user.email, subject: "Verify Your Email - AttendSure Portal", html });
  console.log("Verification email sent to:", user.email, "| ID:", result.id);
  return { success: true };
}

async function sendResendVerificationEmail(user, verificationToken) {
  const link = "https://capstone-backend-hk0h.onrender.com/api/register/verify?token=" + verificationToken;
  const html = "<h2>Hi " + user.firstName + "!</h2><p>New verification link:</p><a href='" + link + "' style='background:#0B84FF;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;display:inline-block;'>Verify Email Address</a><p>Or copy: " + link + "</p><p><strong>Expires in 1 hour.</strong></p>";
  const result = await sendEmail({ to: user.email, subject: "Resend: Verify Your Email - AttendSure Portal", html });
  console.log("Resend email sent to:", user.email, "| ID:", result.id);
  return { success: true };
}

module.exports = { sendVerificationEmail, sendResendVerificationEmail };