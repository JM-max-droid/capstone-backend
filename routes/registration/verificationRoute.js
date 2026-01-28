const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// ✅ GET /api/register/verify?token=xxx
// This handles email verification via browser (web interface)
router.get("/", async (req, res) => {
  try {
    const { token } = req.query;
    
    // No token provided
    if (!token) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #1E293B;
              font-size: 28px;
              margin: 0 0 15px;
            }
            p {
              color: #64748B;
              font-size: 16px;
              line-height: 1.6;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h1>Missing Verification Token</h1>
            <p>Invalid verification link. Please check your email and try again.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Find user with this token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: Date.now() },
    });

    // Token invalid or expired
    if (!user) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #1E293B;
              font-size: 28px;
              margin: 0 0 15px;
            }
            p {
              color: #64748B;
              font-size: 16px;
              line-height: 1.6;
              margin: 0 0 10px;
            }
            .warning-box {
              background-color: #FEF3C7;
              border-left: 4px solid #F59E0B;
              border-radius: 8px;
              padding: 15px;
              margin-top: 20px;
              text-align: left;
            }
            .warning-box p {
              color: #92400E;
              font-size: 14px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏰</div>
            <h1>Verification Link Expired</h1>
            <p>This verification link is invalid or has expired.</p>
            <div class="warning-box">
              <p><strong>⚠️ Note:</strong> Verification links expire after 1 hour for security reasons.</p>
            </div>
            <p style="margin-top: 20px;">Please request a new verification link from the app.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Already verified
    if (user.isVerified) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Already Verified</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 40px;
              max-width: 500px;
              width: 100%;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #1E293B;
              font-size: 28px;
              margin: 0 0 15px;
            }
            p {
              color: #64748B;
              font-size: 16px;
              line-height: 1.6;
              margin: 0;
            }
            .success-box {
              background-color: #D1FAE5;
              border-left: 4px solid #10B981;
              border-radius: 8px;
              padding: 15px;
              margin-top: 20px;
              text-align: left;
            }
            .success-box p {
              color: #065F46;
              font-size: 14px;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✅</div>
            <h1>Already Verified</h1>
            <p>Your email has already been verified.</p>
            <div class="success-box">
              <p><strong>✓ You're all set!</strong> You can now login to your AttendSure account.</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // ✅ VERIFY THE USER
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    console.log("✅ Email verified successfully for:", user.email);

    // Success response
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            animation: slideUp 0.5s ease-out;
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: scaleIn 0.6s ease-out;
          }
          @keyframes scaleIn {
            from {
              transform: scale(0);
            }
            to {
              transform: scale(1);
            }
          }
          h1 {
            color: #1E293B;
            font-size: 32px;
            margin: 0 0 15px;
            font-weight: 700;
          }
          .welcome {
            color: #0B84FF;
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 20px;
          }
          p {
            color: #64748B;
            font-size: 16px;
            line-height: 1.6;
            margin: 0 0 10px;
          }
          .success-box {
            background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
            border-radius: 12px;
            padding: 20px;
            margin-top: 25px;
            text-align: left;
          }
          .success-box p {
            color: #065F46;
            font-size: 15px;
            margin: 0;
          }
          .success-box strong {
            color: #047857;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #E2E8F0;
          }
          .footer p {
            color: #94A3B8;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🎉</div>
          <h1>Email Verified!</h1>
          <p class="welcome">Welcome, ${user.firstName}!</p>
          <p>Your email has been successfully verified.</p>
          
          <div class="success-box">
            <p><strong>✓ What's Next?</strong></p>
            <p style="margin-top: 10px;">
              You can now login to your AttendSure account and start using all features.
            </p>
          </div>
          
          <div class="footer">
            <p>AttendSure Portal © 2025</p>
            <p style="margin-top: 5px; font-size: 12px;">You can close this window now.</p>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("🔥 Verification Error:", err);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            color: #1E293B;
            font-size: 28px;
            margin: 0 0 15px;
          }
          p {
            color: #64748B;
            font-size: 16px;
            line-height: 1.6;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">💥</div>
          <h1>Server Error</h1>
          <p>Something went wrong while verifying your email.</p>
          <p style="margin-top: 15px;">Please try again later or contact support.</p>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;