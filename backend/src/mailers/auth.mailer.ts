import { sendEmail } from './mailer'
import { getVerifyAccountTemplate } from './templates/verify-account.template'
import { getResetPasswordTemplate } from './templates/reset-password.template'
import { REDIS_TTL } from '../config/redis.config'

export type SendAuthEmailParams = {
  email: string
  username: string
  otpCode: string
}

/**
 * Sends an OTP email to verify a new account (Registration)
 */
export const sendVerificationEmail = async (params: SendAuthEmailParams) => {
  const { email, username, otpCode } = params

  const expiresInMinutes = REDIS_TTL.OTP / 60 // Tự động tính ra 5

  // 1. Get HTML template
  const html = getVerifyAccountTemplate(username, otpCode, expiresInMinutes)

  // 2. Prepare text fallback
  const text = `Hi ${username || 'there'}, your Finsight account verification code is: ${otpCode}. This code is valid for 2 minutes.`

  // 3. Execute sending
  return sendEmail({
    to: email,
    subject: 'Account Verification - Finsight',
    text,
    html
  })
}

/**
 * Sends an OTP email to reset password (Forgot Password)
 */
export const sendPasswordResetEmail = async (params: SendAuthEmailParams) => {
  const { email, username, otpCode } = params

  // 1. Get HTML template
  const html = getResetPasswordTemplate(username, otpCode, 2)

  // 2. Prepare text fallback with security warning
  const text = `Hi ${username || 'there'}, your Finsight password reset code is: ${otpCode}. This code is valid for 2 minutes. If you did not request this, please ignore this email.`

  // 3. Execute sending
  return sendEmail({
    to: email,
    subject: 'Password Reset Request - Finsight',
    text,
    html
  })
}
