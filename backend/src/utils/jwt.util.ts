import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import ms from 'ms'
import { Env } from '../config/env.config'

export type AccessTokenPayload = {
  userId: string
  tokenVersion: number
}

export type RefreshTokenPayload = {
  userId: string
}

type TimeUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'y'
type TimeString = `${number}${TimeUnit}`

type SignOptsAndSecret = SignOptions & {
  secret: string
  expiresIn?: TimeString | number
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const JWT_DEFAULTS: SignOptions = {
  audience: ['user'],
  algorithm: 'HS256',
  issuer: Env.JWT_ISSUER
}

const accessTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_EXPIRES_IN as TimeString,
  secret: Env.JWT_SECRET
}

const refreshTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_REFRESH_EXPIRES_IN as TimeString,
  secret: Env.JWT_REFRESH_SECRET,
  audience: 'refresh',
  issuer: Env.JWT_ISSUER // ← must match verifyRefreshToken's issuer check
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign an access token. Returns the token and its expiration timestamp (ms).
 */
export const signAccessToken = (payload: AccessTokenPayload) => {
  const { secret, expiresIn, ...opts } = accessTokenSignOptions

  const token = jwt.sign(payload, secret, {
    ...JWT_DEFAULTS,
    ...opts,
    expiresIn
  })

  const expiresAt = Date.now() + ms(Env.JWT_EXPIRES_IN as ms.StringValue)

  return { token, expiresAt }
}

/**
 * Sign a refresh token. Does not expose expiresAt (managed via DB).
 */
export const signRefreshToken = (payload: RefreshTokenPayload) => {
  const { secret, expiresIn, ...opts } = refreshTokenSignOptions

  const token = jwt.sign(payload, secret, {
    ...opts,
    expiresIn
  })

  return { token }
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify an access token. Validates signature + audience + issuer.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
export const verifyAccessToken = (
  token: string
): JwtPayload & AccessTokenPayload => {
  return jwt.verify(token, Env.JWT_SECRET, {
    audience: 'user',
    issuer: Env.JWT_ISSUER,
    algorithms: ['HS256']
  }) as unknown as JwtPayload & AccessTokenPayload
}

/**
 * Verify a refresh token. Validates signature + issuer.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
export const verifyRefreshToken = (
  token: string
): JwtPayload & RefreshTokenPayload => {
  return jwt.verify(token, Env.JWT_REFRESH_SECRET, {
    issuer: Env.JWT_ISSUER,
    audience: 'refresh',
    algorithms: ['HS256']
  }) as unknown as JwtPayload & RefreshTokenPayload
}
