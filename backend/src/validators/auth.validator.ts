import { z } from 'zod'

// ─── Base Schemas ─────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .min(1)
  .max(255)

export const passwordSchema = z.string().trim().min(4)

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional()
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().optional()
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export const verifyOTPSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'OTP must be 6 digits')
})

export const resendOTPSchema = z.object({
  email: emailSchema
})

export const forgotPasswordSchema = z.object({
  email: emailSchema
})

export const verifyForgotOTPSchema = z.object({
  email: emailSchema,
  otp: z.string().length(6, 'OTP must be 6 digits')
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
  resetToken: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegisterSchemaType = z.infer<typeof registerSchema>
export type LoginSchemaType = z.infer<typeof loginSchema>
export type RefreshTokenSchemaType = z.infer<typeof refreshTokenSchema>
export type VerifyOTPSchemaType = z.infer<typeof verifyOTPSchema>
export type ResendOTPSchemaType = z.infer<typeof resendOTPSchema>
export type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>
export type VerifyForgotOTPSchemaType = z.infer<typeof verifyForgotOTPSchema>
export type ResetPasswordSchemaType = z.infer<typeof resetPasswordSchema>
