const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(user, verificationToken) {
  const link = "https://capstone-backend-hk0h.onrender.com/api/register/verify?token=" + verificationToken;
  const html = "<h2>Hi " + user.firstName + "!</h2><p>Click to verify your email:</p><a href='" + link + "' style='background:#0B84FF;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;display:inline-block;'>Verify Email Address</a><p>Or copy: " + link + "</p><p><strong>Expires in 1 hour.</strong></p>";
  
  await transporter.sendMail({
    from: '"AttendSure" <' + process.env.EMAIL_USER + '>',
    to: user.email,
    subject: "Verify Your Email - AttendSure Portal",
    html,
  });
  console.log("Verification email sent to:", user.email);
  return { success: true };
}

async function sendResendVerificationEmail(user, verificationToken) {
  const link = "https://capstone-backend-hk0h.onrender.com/api/register/verify?token=" + verificationToken;
  const html = "<h2>Hi " + user.firstName + "!</h2><p>New verification link:</p><a href='" + link + "' style='background:#0B84FF;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;display:inline-block;'>Verify Email Address</a><p>Or copy: " + link + "</p><p><strong>Expires in 1 hour.</strong></p>";
  
  await transporter.sendMail({
    from: '"AttendSure" <' + process.env.EMAIL_USER + '>',
    to: user.email,
    subject: "Resend: Verify Your Email - AttendSure Portal",
    html,
  });
  console.log("Resend email sent to:", user.email);
  return { success: true };
}

module.exports = { sendVerificationEmail, sendResendVerificationEmail };