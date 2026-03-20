import { z } from 'zod'

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  timezone: z.string().optional(),
  preferredCurrency: z.string().optional()
})

export type UpdateUserType = z.infer<typeof updateUserSchema>
