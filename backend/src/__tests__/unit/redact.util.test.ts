import { maskEmail, redactSensitiveFields } from '../../utils/redact.util'

describe('redactSensitiveFields', () => {
  it('masks email fields without redacting the whole value', () => {
    expect(
      redactSensitiveFields({
        email: 'giahuyduong2909@gmail.com',
        nested: {
          Email: 'Admin@Example.com'
        }
      })
    ).toEqual({
      email: 'g***@gmail.com',
      nested: {
        Email: 'A***@Example.com'
      }
    })
  })

  it('keeps existing full redaction for secret fields', () => {
    expect(
      redactSensitiveFields({
        password: 'Password123!',
        token: 'secret-token',
        refreshToken: 'secret-refresh-token',
        email: 'user@example.com'
      })
    ).toEqual({
      password: '[REDACTED]',
      token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      email: 'u***@example.com'
    })
  })
})

describe('maskEmail', () => {
  it('masks valid email values', () => {
    expect(maskEmail('a@example.com')).toBe('a***@example.com')
    expect(maskEmail('User@Example.com')).toBe('U***@Example.com')
  })

  it('leaves invalid or non-string values unchanged', () => {
    expect(maskEmail('not-an-email')).toBe('not-an-email')
    expect(maskEmail('@example.com')).toBe('@example.com')
    expect(maskEmail('a@@example.com')).toBe('a@@example.com')
    expect(maskEmail(null)).toBeNull()
  })
})
