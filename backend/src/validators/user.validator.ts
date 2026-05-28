import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional()
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(4, 'Password must be at least 4 characters'),
    confirmPassword: z.string().min(1, 'Confirm password is required')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword']
  })

export type UpdateUserType = z.infer<typeof updateUserSchema>
export type ChangePasswordSchemaType = z.infer<typeof changePasswordSchema>
