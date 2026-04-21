import { z } from 'zod'

// ─── Base Schemas ─────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .min(1)
  .max(255)

export const passwordSchema = z
  .string()
  .trim()
  .min(6, 'Password must be at least 6 characters')
  .regex(/^[A-Z]/, 'Password must start with an uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')

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

export const changePasswordRequestSchema = z
  .object({
    oldPassword: z.string().min(1, 'Old password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password don't match",
    path: ['confirmPassword']
  })

export const verifyChangePasswordOTPSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits')
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
export type ChangePasswordRequestSchemaType = z.infer<
  typeof changePasswordRequestSchema
>
export type VerifyChangePasswordOTPSchemaType = z.infer<
  typeof verifyChangePasswordOTPSchema
>

export const changeEmailRequestSchema = z.object({
  newEmail: emailSchema
})

export type ChangeEmailRequestSchemaType = z.infer<
  typeof changeEmailRequestSchema
>

export const verifyChangeEmailOTPSchema = z.object({
  oldEmailOtp: z.string().length(6, 'Old email OTP must be 6 digits'),
  newEmailOtp: z.string().length(6, 'New email OTP must be 6 digits')
})

export type VerifyChangeEmailOTPSchemaType = z.infer<
  typeof verifyChangeEmailOTPSchema
>
