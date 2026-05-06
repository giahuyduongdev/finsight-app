import { sendEmail } from './mailer'
import { getVerifyAccountTemplate } from './templates/verify-account.template'
import { getResetPasswordTemplate } from './templates/reset-password.template'
import { getChangePasswordTemplate } from './templates/change-password.template'
import { getChangeEmailOldTemplate } from './templates/change-email-old.template'
import { getChangeEmailNewTemplate } from './templates/change-email-new.template'
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

  const expiresInMinutes = REDIS_TTL.FORGOT_OTP / 60 // Tự động tính từ REDIS_TTL

  // 1. Get HTML template
  const html = getResetPasswordTemplate(username, otpCode, expiresInMinutes)

  // 2. Prepare text fallback with security warning
  const text = `Hi ${username || 'there'}, your Finsight password reset code is: ${otpCode}. This code is valid for ${expiresInMinutes} minutes. If you did not request this, please ignore this email.`

  // 3. Execute sending
  return sendEmail({
    to: email,
    subject: 'Password Reset Request - Finsight',
    text,
    html
  })
}

/**
 * Sends an OTP email to confirm password change (Change Password)
 */
export const sendChangePasswordEmail = async (params: SendAuthEmailParams) => {
  const { email, username, otpCode } = params

  const expiresInMinutes = REDIS_TTL.CHANGE_PASSWORD_OTP / 60

  // 1. Get HTML template
  const html = getChangePasswordTemplate(username, otpCode, expiresInMinutes)

  // 2. Prepare text fallback
  const text = `Hi ${username || 'there'}, your Finsight password change verification code is: ${otpCode}. This code is valid for ${expiresInMinutes} minutes.`

  // 3. Execute sending
  return sendEmail({
    to: email,
    subject: 'Confirm Password Change - Finsight',
    text,
    html
  })
}

/**
 * Sends an OTP email to authorize email change (Sent to OLD email)
 */
export const sendChangeEmailOldOTP = async (params: SendAuthEmailParams) => {
  const { email, username, otpCode } = params
  const expiresInMinutes = REDIS_TTL.CHANGE_EMAIL_OTP / 60
  const html = getChangeEmailOldTemplate(username, otpCode, expiresInMinutes)
  const text = `Hi ${username || 'there'}, your Finsight email change authorization code is: ${otpCode}.`

  return sendEmail({
    to: email,
    subject: 'Authorize Email Change - Finsight',
    text,
    html
  })
}

/**
 * Sends an OTP email to verify new email address (Sent to NEW email)
 */
export const sendChangeEmailNewOTP = async (params: SendAuthEmailParams) => {
  const { email, username, otpCode } = params
  const expiresInMinutes = REDIS_TTL.CHANGE_EMAIL_OTP / 60
  const html = getChangeEmailNewTemplate(username, otpCode, expiresInMinutes)
  const text = `Hi ${username || 'there'}, your Finsight new email verification code is: ${otpCode}.`

  return sendEmail({
    to: email,
    subject: 'Verify Your New Email - Finsight',
    text,
    html
  })
}
