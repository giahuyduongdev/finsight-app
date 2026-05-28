export const getChangeEmailNewTemplate = (
  username: string,
  otpCode: string,
  expiresInMinutes: number = 5
) => {
  const currentYear = new Date().getFullYear()
  const title = 'Verify New Email Address'

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Roboto', Arial, sans-serif; background-color: #f7f7f7; font-size: 16px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f7; padding: 20px;">
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
              
              <tr>
                <td style="background-color: #00bc7d; padding: 20px 30px; color: #ffffff; text-align: center;">
                  <h2 style="margin: 0; font-size: 24px; text-transform: capitalize">Verify Your New Email</h2>
                </td>
              </tr>
              
              <tr>
                <td style="padding: 20px 30px;">
                  <p style="margin: 0 0 10px; font-size: 16px;">Hi <strong>${username || 'there'}</strong>,</p>
                  <p style="margin: 0 0 20px; font-size: 16px;">You are setting this address as your new email for Finsight. Please use the verification code below to confirm you have access to this mailbox:</p>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <div style="background-color: #f0fdf4; border: 2px dashed #00bc7d; padding: 20px 40px; display: inline-block; border-radius: 8px;">
                          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #00bc7d; margin-left: 8px;">${otpCode}</span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 10px; font-size: 16px;">This code will expire in <strong>${expiresInMinutes} minutes</strong>.</p>
                  <hr style="margin: 25px 0; border: none; border-top: 1px solid #e0e0e0;" />
                  <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.5;">If you did not initiate this change, please ignore this email.</p>
                </td>
              </tr>
              
              <tr>
                <td style="background-color: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #999;">
                  &copy; ${currentYear} Finsight. All rights reserved.
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `
}
