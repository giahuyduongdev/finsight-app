import { sendEmail } from './mailer'
import { getVerifyAccountTemplate } from './templates/verify-account.template'
import { getResetPasswordTemplate } from './templates/reset-password.template'
import { getChangePasswordTemplate } from './templates/change-password.template'
import { getChangeEmailOldTemplate } from './templates/change-email-old.template'
import { getChangeEmailNewTemplate } from './templates/change-email-new.template'
import { getSecurityNotificationTemplate } from './templates/security-notification.template'
import { REDIS_TTL } from '../config/redis.config'

export type SendAuthEmailParams = {
  email: string
  username: string
  otpCode: string
}

export type SendSecurityNotificationParams = {
  email: string
  username: string
}

export type SendEmailChangedNotificationParams =
  SendSecurityNotificationParams & {
    oldEmail: string
    newEmail: string
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

export const sendPasswordChangedEmail = async ({
  email,
  username
}: SendSecurityNotificationParams) => {
  const html = getSecurityNotificationTemplate({
    username,
    title: 'Password Changed - Finsight',
    heading: 'Password Changed',
    message: 'The password for your Finsight account was changed successfully.',
    warning:
      'If you did not make this change, contact support immediately and secure your account.'
  })
  const text = `Hi ${username || 'there'}, the password for your Finsight account was changed successfully. If you did not make this change, contact support immediately.`

  return sendEmail({
    to: email,
    subject: 'Password Changed - Finsight',
    text,
    html
  })
}

export const sendPasswordResetSuccessEmail = async ({
  email,
  username
}: SendSecurityNotificationParams) => {
  const html = getSecurityNotificationTemplate({
    username,
    title: 'Password Reset Complete - Finsight',
    heading: 'Password Reset Complete',
    message: 'The password for your Finsight account was reset successfully.',
    warning:
      'If you did not reset your password, contact support immediately and secure your account.'
  })
  const text = `Hi ${username || 'there'}, the password for your Finsight account was reset successfully. If you did not reset your password, contact support immediately.`

  return sendEmail({
    to: email,
    subject: 'Password Reset Complete - Finsight',
    text,
    html
  })
}

export const sendEmailChangedOldAddressEmail = async ({
  email,
  username,
  newEmail
}: SendEmailChangedNotificationParams) => {
  const html = getSecurityNotificationTemplate({
    username,
    title: 'Email Changed - Finsight',
    heading: 'Email Changed',
    message: `Your Finsight account email was changed to ${newEmail}.`,
    warning:
      'If you did not make this change, contact support immediately and secure your account.'
  })
  const text = `Hi ${username || 'there'}, your Finsight account email was changed to ${newEmail}. If you did not make this change, contact support immediately.`

  return sendEmail({
    to: email,
    subject: 'Email Changed - Finsight',
    text,
    html
  })
}

export const sendEmailChangedNewAddressEmail = async ({
  email,
  username,
  oldEmail
}: SendEmailChangedNotificationParams) => {
  const html = getSecurityNotificationTemplate({
    username,
    title: 'Email Added - Finsight',
    heading: 'Email Added',
    message: `This email address is now attached to the Finsight account previously using ${oldEmail}.`,
    warning:
      'If you did not make this change, contact support immediately and secure your account.'
  })
  const text = `Hi ${username || 'there'}, this email address is now attached to the Finsight account previously using ${oldEmail}. If you did not make this change, contact support immediately.`

  return sendEmail({
    to: email,
    subject: 'Email Added - Finsight',
    text,
    html
  })
}
