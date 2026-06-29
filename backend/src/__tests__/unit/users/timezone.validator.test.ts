import { loginSchema, registerSchema } from '../../../validators/auth.validator'
import { updateUserSchema } from '../../../validators/user.validator'

describe('timezone validators', () => {
  it('normalizes auth register timezone aliases', () => {
    const result = registerSchema.parse({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password1!',
      timezone: 'Asia/Saigon'
    })

    expect(result.timezone).toBe('Asia/Ho_Chi_Minh')
  })

  it('normalizes auth login timezone aliases', () => {
    const result = loginSchema.parse({
      email: 'test@example.com',
      password: 'Password1!',
      timezone: 'Asia/Saigon'
    })

    expect(result.timezone).toBe('Asia/Ho_Chi_Minh')
  })

  it('accepts valid non-dropdown timezone values', () => {
    const result = updateUserSchema.parse({
      timezone: 'America/Denver'
    })

    expect(result.timezone).toBe('America/Denver')
  })

  it('keeps missing timezone optional', () => {
    expect(updateUserSchema.parse({})).toEqual({})
  })

  it('rejects invalid timezone values', () => {
    expect(() => updateUserSchema.parse({ timezone: 'Mars/Base' })).toThrow()
  })
})
