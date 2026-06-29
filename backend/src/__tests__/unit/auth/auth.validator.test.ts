import { loginSchema, registerSchema } from '../../../validators/auth.validator'

describe('auth validators', () => {
  it('canonicalizes registration email before service use', () => {
    const result = registerSchema.parse({
      name: 'Test User',
      email: '  User@Example.COM  ',
      password: 'Password1!'
    })

    expect(result.email).toBe('user@example.com')
  })

  it('preserves the exact login password without applying creation rules', () => {
    const result = loginSchema.parse({
      email: 'user@example.com',
      password: ' legacy password '
    })

    expect(result.password).toBe(' legacy password ')
  })

  it('rejects an empty login password', () => {
    expect(() =>
      loginSchema.parse({
        email: 'user@example.com',
        password: ''
      })
    ).toThrow()
  })
})
