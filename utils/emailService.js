const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send verification email using SendGrid HTTP API
 * @param {Object} user - User object containing email, firstName, etc.
 * @param {string} verificationToken - Generated verification token
 * @returns {Promise<Object>} - Success status
 */
async function sendVerificationEmail(user, verificationToken) {
  const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;
  
  const msg = {
    to: user.email,
    from: 'attendsure6@gmail.com', // Must be verified in SendGrid
    subject: 'Verify Your Email - AttendSure Portal',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      🎉 Welcome to AttendSure!
                    </h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px; color: #1E293B; font-size: 22px; font-weight: 600;">
                      Hi ${user.firstName}!
                    </h2>
                    
                    <p style="margin: 0 0 20px; color: #64748B; font-size: 16px; line-height: 1.6;">
                      Thank you for registering! We're excited to have you on board. 
                      To complete your registration and access your account, please verify your email address.
                    </p>
                    
                    <p style="margin: 0 0 30px; color: #64748B; font-size: 16px; line-height: 1.6;">
                      Click the button below to verify your email:
                    </p>
                    
                    <!-- Button -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${verificationLink}" 
                             style="display: inline-block; background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); 
                                    color: #ffffff; text-decoration: none; padding: 16px 40px; 
                                    border-radius: 12px; font-size: 16px; font-weight: 600; 
                                    box-shadow: 0 4px 12px rgba(11, 132, 255, 0.3);">
                            ✅ Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 30px 0 0; color: #94A3B8; font-size: 14px; line-height: 1.6;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin: 10px 0 0; color: #0B84FF; font-size: 14px; word-break: break-all;">
                      ${verificationLink}
                    </p>
                    
                    <div style="margin-top: 30px; padding: 20px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px;">
                      <p style="margin: 0; color: #92400E; font-size: 14px; line-height: 1.6;">
                        ⚠️ <strong>Important:</strong> This verification link will expire in 1 hour.
                      </p>
                    </div>
                    
                    <p style="margin: 30px 0 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                      If you didn't create this account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                    <p style="margin: 0 0 10px; color: #94A3B8; font-size: 13px;">
                      AttendSure Portal © 2025
                    </p>
                    <p style="margin: 0; color: #CBD5E1; font-size: 12px;">
                      This is an automated email. Please do not reply.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Verification email sent successfully to:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
    throw error;
  }
}

/**
 * Send resend verification email
 * @param {Object} user - User object containing email, firstName, etc.
 * @param {string} verificationToken - Generated verification token
 * @returns {Promise<Object>} - Success status
 */
async function sendResendVerificationEmail(user, verificationToken) {
  const verificationLink = `https://capstone-backend-hk0h.onrender.com/api/register/verify?token=${verificationToken}`;
  
  const msg = {
    to: user.email,
    from: 'attendsure6@gmail.com',
    subject: 'Resend: Verify Your Email - AttendSure Portal',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      🔁 Verification Link Resent
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px; color: #1E293B; font-size: 22px; font-weight: 600;">
                      Hi ${user.firstName}!
                    </h2>
                    <p style="margin: 0 0 30px; color: #64748B; font-size: 16px; line-height: 1.6;">
                      You requested a new verification link. Click the button below to verify your email:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${verificationLink}" 
                             style="display: inline-block; background: linear-gradient(135deg, #0B84FF 0%, #0073E6 100%); 
                                    color: #ffffff; text-decoration: none; padding: 16px 40px; 
                                    border-radius: 12px; font-size: 16px; font-weight: 600;
                                    box-shadow: 0 4px 12px rgba(11, 132, 255, 0.3);">
                            ✅ Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 30px 0 0; color: #94A3B8; font-size: 14px; line-height: 1.6;">
                      Or copy and paste this link:
                    </p>
                    <p style="margin: 10px 0 0; color: #0B84FF; font-size: 14px; word-break: break-all;">
                      ${verificationLink}
                    </p>
                    <div style="margin-top: 30px; padding: 20px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px;">
                      <p style="margin: 0; color: #92400E; font-size: 14px;">
                        ⚠️ <strong>Important:</strong> This link will expire in 1 hour.
                      </p>
                    </div>
                    <p style="margin: 30px 0 0; color: #64748B; font-size: 14px; line-height: 1.6;">
                      If you didn't request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0;">
                    <p style="margin: 0 0 10px; color: #94A3B8; font-size: 13px;">
                      AttendSure Portal © 2025
                    </p>
                    <p style="margin: 0; color: #CBD5E1; font-size: 12px;">
                      This is an automated email. Please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Resend verification email sent successfully to:', user.email);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid Error:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  sendResendVerificationEmail,
};