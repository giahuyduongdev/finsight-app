import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import ms from 'ms'
import { Env } from '../config/env.config'
import {
  getCurrentJwtSigningKey,
  resolveJwtVerifySecret
} from './jwt-key-ring.util'

export type AccessTokenPayload = {
  userId: string
  tokenVersion: number
}

export type RefreshTokenPayload = {
  userId: string
  jti?: string
}

type TimeUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'y'
type TimeString = `${number}${TimeUnit}`

type JwtSignOptions = SignOptions & {
  expiresIn?: TimeString | number
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const JWT_DEFAULTS: SignOptions = {
  audience: ['user'],
  algorithm: 'HS256',
  issuer: Env.JWT_ISSUER
}

const accessTokenSignOptions: JwtSignOptions = {
  expiresIn: Env.JWT_EXPIRES_IN as TimeString
}

const refreshTokenSignOptions: JwtSignOptions = {
  expiresIn: Env.JWT_REFRESH_EXPIRES_IN as TimeString,
  audience: 'refresh',
  issuer: Env.JWT_ISSUER // ← must match verifyRefreshToken's issuer check
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * Sign an access token. Returns the token and its expiration timestamp (ms).
 */
export const signAccessToken = (payload: AccessTokenPayload) => {
  const { expiresIn, ...opts } = accessTokenSignOptions
  const { kid, secret } = getCurrentJwtSigningKey('access')

  const token = jwt.sign(payload, secret, {
    ...JWT_DEFAULTS,
    ...opts,
    expiresIn,
    keyid: kid
  })

  const expiresAt = Date.now() + ms(Env.JWT_EXPIRES_IN as ms.StringValue)

  return { token, expiresAt }
}

/**
 * Sign a refresh token. Does not expose expiresAt (managed via DB).
 */
export const signRefreshToken = (payload: RefreshTokenPayload) => {
  const { expiresIn, ...opts } = refreshTokenSignOptions
  const { kid, secret } = getCurrentJwtSigningKey('refresh')

  const token = jwt.sign(payload, secret, {
    ...opts,
    expiresIn,
    keyid: kid
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
  return jwt.verify(token, resolveJwtVerifySecret(token, 'access'), {
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
  return jwt.verify(token, resolveJwtVerifySecret(token, 'refresh'), {
    issuer: Env.JWT_ISSUER,
    audience: 'refresh',
    algorithms: ['HS256']
  }) as unknown as JwtPayload & RefreshTokenPayload
}
