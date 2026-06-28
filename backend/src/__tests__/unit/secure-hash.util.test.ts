import crypto from 'crypto'
import { Env } from '../../config/env.config'
import {
  hashAccessTokenBlacklistKey,
  hashAuthEmailKey,
  hashOtp,
  hashRefreshToken,
  hashResetToken
} from '../../utils/secure-hash.util'

describe('secure hash utility', () => {
  const originalSecret = Env.TOKEN_HASH_SECRET

  afterEach(() => {
    Env.TOKEN_HASH_SECRET = originalSecret
  })

  it('uses HMAC-SHA256 with TOKEN_HASH_SECRET', () => {
    Env.TOKEN_HASH_SECRET = 'unit-test-token-hash-secret'

    const expected = crypto
      .createHmac('sha256', Env.TOKEN_HASH_SECRET)
      .update('otp:123456')
      .digest('hex')

    expect(hashOtp('123456')).toBe(expected)
  })

  it('separates digest purposes for the same value', () => {
    Env.TOKEN_HASH_SECRET = 'unit-test-token-hash-secret'

    const value = 'same-value'
    const digests = new Set([
      hashOtp(value),
      hashResetToken(value),
      hashRefreshToken(value),
      hashAccessTokenBlacklistKey(value)
    ])

    expect(digests.size).toBe(4)
  })

  it('canonicalizes auth email key input', () => {
    Env.TOKEN_HASH_SECRET = 'unit-test-token-hash-secret'

    expect(hashAuthEmailKey(' User@Example.com ')).toBe(
      hashAuthEmailKey('user@example.com')
    )
  })

  it('fails closed without TOKEN_HASH_SECRET', () => {
    Env.TOKEN_HASH_SECRET = ''

    expect(() => hashOtp('123456')).toThrow(
      'TOKEN_HASH_SECRET is required for auth digests'
    )
  })
})
