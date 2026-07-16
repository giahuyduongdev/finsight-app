import jwt from 'jsonwebtoken'
import { Env } from '../../../config/env.config'
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from '../../../utils/jwt.util'

describe('access token versioning', () => {
  it('preserves the token version through signing and verification', () => {
    const { token } = signAccessToken({
      userId: 'user-123',
      tokenVersion: 7
    })

    expect(verifyAccessToken(token)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        tokenVersion: 7
      })
    )
  })
})

describe('jwt verification hardening', () => {
  it('rejects access tokens using alg none', () => {
    const token = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      '',
      {
        algorithm: 'none',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m'
      }
    )

    expect(() => verifyAccessToken(token)).toThrow()
  })

  it('rejects access tokens signed with a non-HS256 algorithm', () => {
    const token = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      Env.JWT_SECRET,
      {
        algorithm: 'HS384',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m'
      }
    )

    expect(() => verifyAccessToken(token)).toThrow()
  })

  it('preserves the refresh payload through signing and verification', () => {
    const { token } = signRefreshToken({ userId: 'user-123' })

    expect(verifyRefreshToken(token)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        aud: 'refresh'
      })
    )
  })

  it('rejects refresh tokens using alg none', () => {
    const token = jwt.sign({ userId: 'user-123' }, '', {
      algorithm: 'none',
      audience: 'refresh',
      issuer: Env.JWT_ISSUER,
      expiresIn: '7d'
    })

    expect(() => verifyRefreshToken(token)).toThrow()
  })

  it('rejects refresh tokens signed with a non-HS256 algorithm', () => {
    const token = jwt.sign({ userId: 'user-123' }, Env.JWT_REFRESH_SECRET, {
      algorithm: 'HS384',
      audience: 'refresh',
      issuer: Env.JWT_ISSUER,
      expiresIn: '7d'
    })

    expect(() => verifyRefreshToken(token)).toThrow()
  })

  it('rejects refresh tokens with missing or wrong audience', () => {
    const tokenWithoutAudience = jwt.sign(
      { userId: 'user-123' },
      Env.JWT_REFRESH_SECRET,
      {
        algorithm: 'HS256',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d'
      }
    )
    const tokenWithWrongAudience = jwt.sign(
      { userId: 'user-123' },
      Env.JWT_REFRESH_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d'
      }
    )

    expect(() => verifyRefreshToken(tokenWithoutAudience)).toThrow()
    expect(() => verifyRefreshToken(tokenWithWrongAudience)).toThrow()
  })

  it('rejects access tokens used as refresh tokens', () => {
    const { token } = signAccessToken({
      userId: 'user-123',
      tokenVersion: 7
    })

    expect(() => verifyRefreshToken(token)).toThrow()
  })
})
