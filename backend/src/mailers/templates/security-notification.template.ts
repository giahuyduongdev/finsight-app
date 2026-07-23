type SecurityNotificationParams = {
  username: string
  title: string
  heading: string
  message: string
  warning: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const getSecurityNotificationTemplate = ({
  username,
  title,
  heading,
  message,
  warning
}: SecurityNotificationParams) => {
  const currentYear = new Date().getFullYear()
  const safeUsername = escapeHtml(username || 'there')
  const safeTitle = escapeHtml(title)
  const safeHeading = escapeHtml(heading)
  const safeMessage = escapeHtml(message)
  const safeWarning = escapeHtml(warning)

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${safeTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Roboto', Arial, sans-serif; background-color: #f7f7f7; font-size: 16px;">
      <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f7f7f7; padding: 20px;">
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
              <tr>
                <td style="background-color: #00bc7d; padding: 20px 30px; color: #ffffff; text-align: center;">
                  <h2 style="margin: 0; font-size: 24px;">${safeHeading}</h2>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px;">
                  <p style="margin: 0 0 10px; font-size: 16px;">Hi <strong>${safeUsername}</strong>,</p>
                  <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5;">${safeMessage}</p>
                  <hr style="margin: 25px 0; border: none; border-top: 1px solid #e0e0e0;" />
                  <p style="margin: 0; font-size: 13px; color: #888; line-height: 1.5;">${safeWarning}</p>
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
