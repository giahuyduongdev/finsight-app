import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import ms from 'ms'
import { Env } from '../config/env.config'

export type AccessTokenPayload = {
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
  algorithm: 'HS256'
}

const accessTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_EXPIRES_IN as TimeString,
  secret: Env.JWT_SECRET
}

const refreshTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_REFRESH_EXPIRES_IN as TimeString,
  secret: Env.JWT_REFRESH_SECRET,
  audience: 'refresh'
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
export const signRefreshToken = (payload: AccessTokenPayload) => {
  const { secret, expiresIn, ...opts } = refreshTokenSignOptions

  const token = jwt.sign(payload, secret, {
    ...opts,
    expiresIn
  })

  return { token }
}

// ─── Verify ───────────────────────────────────────────────────────────────────

/**
 * Verify an access token. Validates signature + audience.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
export const verifyAccessToken = (
  token: string
): JwtPayload & AccessTokenPayload => {
  return jwt.verify(token, Env.JWT_SECRET, {
    audience: 'user'
  }) as unknown as JwtPayload & AccessTokenPayload
}

/**
 * Verify a refresh token. Validates signature only (no audience).
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
export const verifyRefreshToken = (
  token: string
): JwtPayload & AccessTokenPayload => {
  return jwt.verify(token, Env.JWT_REFRESH_SECRET) as unknown as JwtPayload &
    AccessTokenPayload
}
