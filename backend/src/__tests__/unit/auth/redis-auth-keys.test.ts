jest.mock('../../../databases/redis.database', () => ({
  redis: {
    call: jest.fn()
  }
}))

jest.mock('rate-limit-redis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('express-rate-limit', () =>
  jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next())
)

const { REDIS_KEYS } = jest.requireActual(
  '../../../config/redis.config'
) as typeof import('../../../config/redis.config')

describe('auth Redis key builders', () => {
  it('does not include raw email in email-scoped auth keys', () => {
    const email = 'User@Example.com'
    const keys = [
      REDIS_KEYS.registerOtp(email),
      REDIS_KEYS.registerPending(email),
      REDIS_KEYS.registerResend(email),
      REDIS_KEYS.registerAttempts(email),
      REDIS_KEYS.forgotOtp(email),
      REDIS_KEYS.forgotResend(email),
      REDIS_KEYS.forgotAttempts(email),
      REDIS_KEYS.resetToken(email),
      REDIS_KEYS.changePasswordOtp(email),
      REDIS_KEYS.changePasswordPending(email),
      REDIS_KEYS.changePasswordResend(email),
      REDIS_KEYS.changePasswordAttempts(email)
    ]

    for (const key of keys) {
      expect(key).not.toContain('User@Example.com')
      expect(key).not.toContain('user@example.com')
      expect(key).toMatch(/[a-f0-9]{64}$/)
    }
  })

  it('uses canonical email for email-scoped auth keys', () => {
    expect(REDIS_KEYS.registerOtp(' User@Example.com ')).toBe(
      REDIS_KEYS.registerOtp('user@example.com')
    )
  })

  it('keeps user-id scoped change-email keys user-id based', () => {
    expect(REDIS_KEYS.changeEmailOtpOld('user-123')).toBe(
      'otp:change-email:old:user-123'
    )
    expect(REDIS_KEYS.changeEmailPending('user-123')).toBe(
      'pending:change-email:user-123'
    )
  })
})
