import crypto from 'crypto'
import { Env } from '../config/env.config'

const getTokenHashSecret = () => {
  const secret = Env.TOKEN_HASH_SECRET?.trim()
  if (!secret) {
    throw new Error('TOKEN_HASH_SECRET is required for auth digests')
  }
  return secret
}

const hmacDigest = (purpose: string, value: string) =>
  crypto
    .createHmac('sha256', getTokenHashSecret())
    .update(`${purpose}:${value}`)
    .digest('hex')

const canonicalizeEmail = (email: string) => email.trim().toLowerCase()

export const hashOtp = (value: string) => hmacDigest('otp', value)

export const hashResetToken = (value: string) =>
  hmacDigest('reset-token', value)

export const hashRefreshToken = (value: string) =>
  hmacDigest('refresh-token', value)

export const hashAccessTokenBlacklistKey = (value: string) =>
  hmacDigest('access-token-blacklist', value)

export const hashAuthEmailKey = (email: string) =>
  hmacDigest('auth-email-key', canonicalizeEmail(email))
