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
  const originalJwtConfig = {
    accessCurrentKid: Env.JWT_ACCESS_CURRENT_KID,
    accessCurrentSecret: Env.JWT_ACCESS_CURRENT_SECRET,
    accessPreviousKid: Env.JWT_ACCESS_PREVIOUS_KID,
    accessPreviousSecret: Env.JWT_ACCESS_PREVIOUS_SECRET,
    refreshCurrentKid: Env.JWT_REFRESH_CURRENT_KID,
    refreshCurrentSecret: Env.JWT_REFRESH_CURRENT_SECRET,
    refreshPreviousKid: Env.JWT_REFRESH_PREVIOUS_KID,
    refreshPreviousSecret: Env.JWT_REFRESH_PREVIOUS_SECRET,
    accessLegacyFallbackEnabled: Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED,
    refreshLegacyFallbackEnabled: Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED
  }

  beforeEach(() => {
    Env.JWT_ACCESS_CURRENT_KID = 'access-current'
    Env.JWT_ACCESS_CURRENT_SECRET = 'access-current-secret'
    Env.JWT_ACCESS_PREVIOUS_KID = 'access-previous'
    Env.JWT_ACCESS_PREVIOUS_SECRET = 'access-previous-secret'
    Env.JWT_REFRESH_CURRENT_KID = 'refresh-current'
    Env.JWT_REFRESH_CURRENT_SECRET = 'refresh-current-secret'
    Env.JWT_REFRESH_PREVIOUS_KID = 'refresh-previous'
    Env.JWT_REFRESH_PREVIOUS_SECRET = 'refresh-previous-secret'
    Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED = 'true'
    Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED = 'true'
  })

  afterAll(() => {
    Env.JWT_ACCESS_CURRENT_KID = originalJwtConfig.accessCurrentKid
    Env.JWT_ACCESS_CURRENT_SECRET = originalJwtConfig.accessCurrentSecret
    Env.JWT_ACCESS_PREVIOUS_KID = originalJwtConfig.accessPreviousKid
    Env.JWT_ACCESS_PREVIOUS_SECRET = originalJwtConfig.accessPreviousSecret
    Env.JWT_REFRESH_CURRENT_KID = originalJwtConfig.refreshCurrentKid
    Env.JWT_REFRESH_CURRENT_SECRET = originalJwtConfig.refreshCurrentSecret
    Env.JWT_REFRESH_PREVIOUS_KID = originalJwtConfig.refreshPreviousKid
    Env.JWT_REFRESH_PREVIOUS_SECRET = originalJwtConfig.refreshPreviousSecret
    Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED =
      originalJwtConfig.accessLegacyFallbackEnabled
    Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED =
      originalJwtConfig.refreshLegacyFallbackEnabled
  })

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

  it('signs access and refresh tokens with current key ids', () => {
    const { token: accessToken } = signAccessToken({
      userId: 'user-123',
      tokenVersion: 7
    })
    const { token: refreshToken } = signRefreshToken({ userId: 'user-123' })

    expect(jwt.decode(accessToken, { complete: true })).toEqual(
      expect.objectContaining({
        header: expect.objectContaining({
          kid: 'access-current',
          alg: 'HS256'
        })
      })
    )
    expect(jwt.decode(refreshToken, { complete: true })).toEqual(
      expect.objectContaining({
        header: expect.objectContaining({
          kid: 'refresh-current',
          alg: 'HS256'
        })
      })
    )
  })

  it('verifies tokens signed with previous key ids', () => {
    const accessToken = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      Env.JWT_ACCESS_PREVIOUS_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m',
        keyid: Env.JWT_ACCESS_PREVIOUS_KID
      }
    )
    const refreshToken = jwt.sign(
      {
        userId: 'user-123'
      },
      Env.JWT_REFRESH_PREVIOUS_SECRET,
      {
        algorithm: 'HS256',
        audience: 'refresh',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d',
        keyid: Env.JWT_REFRESH_PREVIOUS_KID
      }
    )

    expect(verifyAccessToken(accessToken)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        tokenVersion: 7
      })
    )
    expect(verifyRefreshToken(refreshToken)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        aud: 'refresh'
      })
    )
  })

  it('rejects unknown and wrong-family key ids', () => {
    const unknownAccessKidToken = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      Env.JWT_ACCESS_CURRENT_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m',
        keyid: 'unknown-access'
      }
    )
    const wrongFamilyAccessToken = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      Env.JWT_REFRESH_CURRENT_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m',
        keyid: Env.JWT_REFRESH_CURRENT_KID
      }
    )
    const wrongFamilyRefreshToken = jwt.sign(
      {
        userId: 'user-123'
      },
      Env.JWT_ACCESS_CURRENT_SECRET,
      {
        algorithm: 'HS256',
        audience: 'refresh',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d',
        keyid: Env.JWT_ACCESS_CURRENT_KID
      }
    )

    expect(() => verifyAccessToken(unknownAccessKidToken)).toThrow()
    expect(() => verifyAccessToken(wrongFamilyAccessToken)).toThrow()
    expect(() => verifyRefreshToken(wrongFamilyRefreshToken)).toThrow()
  })

  it('uses separate legacy fallback flags for no-kid tokens', () => {
    const legacyAccessToken = jwt.sign(
      {
        userId: 'user-123',
        tokenVersion: 7
      },
      Env.JWT_SECRET,
      {
        algorithm: 'HS256',
        audience: 'user',
        issuer: Env.JWT_ISSUER,
        expiresIn: '15m'
      }
    )
    const legacyRefreshToken = jwt.sign(
      {
        userId: 'user-123'
      },
      Env.JWT_REFRESH_SECRET,
      {
        algorithm: 'HS256',
        audience: 'refresh',
        issuer: Env.JWT_ISSUER,
        expiresIn: '7d'
      }
    )

    expect(verifyAccessToken(legacyAccessToken)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        tokenVersion: 7
      })
    )
    expect(verifyRefreshToken(legacyRefreshToken)).toEqual(
      expect.objectContaining({
        userId: 'user-123',
        aud: 'refresh'
      })
    )

    Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED = 'false'
    expect(() => verifyAccessToken(legacyAccessToken)).toThrow()
    expect(verifyRefreshToken(legacyRefreshToken)).toEqual(
      expect.objectContaining({
        userId: 'user-123'
      })
    )

    Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED = 'false'
    expect(() => verifyRefreshToken(legacyRefreshToken)).toThrow()
  })

  it('fails closed when current and previous key ids conflict', () => {
    Env.JWT_ACCESS_PREVIOUS_KID = Env.JWT_ACCESS_CURRENT_KID

    expect(() =>
      signAccessToken({
        userId: 'user-123',
        tokenVersion: 7
      })
    ).toThrow()
  })

  it('fails closed when previous key config is incomplete', () => {
    Env.JWT_REFRESH_PREVIOUS_SECRET = ''

    expect(() =>
      signRefreshToken({
        userId: 'user-123'
      })
    ).toThrow()
  })
})
