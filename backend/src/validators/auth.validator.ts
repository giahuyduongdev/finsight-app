import { z } from 'zod'

export const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .min(1)
  .max(255)

export const passwordSchema = z.string().trim().min(4)

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().optional()
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().optional()
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export type RefreshTokenSchemaType = z.infer<typeof refreshTokenSchema>
export type RegisterSchemaType = z.infer<typeof registerSchema>
export type LoginSchemaType = z.infer<typeof loginSchema>
