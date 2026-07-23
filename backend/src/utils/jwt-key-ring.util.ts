import jwt from 'jsonwebtoken'
import { Env } from '../config/env.config'

type TokenFamily = 'access' | 'refresh'

type KeyPair = {
  kid: string
  secret: string
}

type KeyConfig = {
  current: KeyPair
  previous?: KeyPair
  legacySecret: string
  legacyFallbackEnabled: boolean
}

const isEnabled = (value: string) => value.trim().toLowerCase() === 'true'

const requireTrimmed = (name: string, value: string) => {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${name} is required`)
  return trimmed
}

const optionalPair = (
  kidName: string,
  kidValue: string,
  secretName: string,
  secretValue: string
): KeyPair | undefined => {
  const kid = kidValue.trim()
  const secret = secretValue.trim()

  if (!kid && !secret) return undefined
  if (!kid || !secret) {
    throw new Error(`${kidName} and ${secretName} must be configured together`)
  }

  return { kid, secret }
}

const getKeyConfig = (family: TokenFamily): KeyConfig => {
  if (family === 'access') {
    const current = {
      kid: requireTrimmed('JWT_ACCESS_CURRENT_KID', Env.JWT_ACCESS_CURRENT_KID),
      secret: requireTrimmed(
        'JWT_ACCESS_CURRENT_SECRET',
        Env.JWT_ACCESS_CURRENT_SECRET
      )
    }
    const previous = optionalPair(
      'JWT_ACCESS_PREVIOUS_KID',
      Env.JWT_ACCESS_PREVIOUS_KID,
      'JWT_ACCESS_PREVIOUS_SECRET',
      Env.JWT_ACCESS_PREVIOUS_SECRET
    )

    if (previous && previous.kid === current.kid) {
      throw new Error('JWT access current and previous kids must be different')
    }

    return {
      current,
      previous,
      legacySecret: requireTrimmed('JWT_SECRET', Env.JWT_SECRET),
      legacyFallbackEnabled: isEnabled(Env.JWT_ACCESS_LEGACY_FALLBACK_ENABLED)
    }
  }

  const current = {
    kid: requireTrimmed('JWT_REFRESH_CURRENT_KID', Env.JWT_REFRESH_CURRENT_KID),
    secret: requireTrimmed(
      'JWT_REFRESH_CURRENT_SECRET',
      Env.JWT_REFRESH_CURRENT_SECRET
    )
  }
  const previous = optionalPair(
    'JWT_REFRESH_PREVIOUS_KID',
    Env.JWT_REFRESH_PREVIOUS_KID,
    'JWT_REFRESH_PREVIOUS_SECRET',
    Env.JWT_REFRESH_PREVIOUS_SECRET
  )

  if (previous && previous.kid === current.kid) {
    throw new Error('JWT refresh current and previous kids must be different')
  }

  return {
    current,
    previous,
    legacySecret: requireTrimmed('JWT_REFRESH_SECRET', Env.JWT_REFRESH_SECRET),
    legacyFallbackEnabled: isEnabled(Env.JWT_REFRESH_LEGACY_FALLBACK_ENABLED)
  }
}

export const getCurrentJwtSigningKey = (family: TokenFamily): KeyPair =>
  getKeyConfig(family).current

export const resolveJwtVerifySecret = (
  token: string,
  family: TokenFamily
): string => {
  const config = getKeyConfig(family)
  const decoded = jwt.decode(token, { complete: true })

  if (!decoded || typeof decoded !== 'object') {
    throw new Error('Invalid JWT')
  }

  const kid = decoded.header.kid
  if (typeof kid === 'string' && kid.trim()) {
    if (kid === config.current.kid) return config.current.secret
    if (config.previous && kid === config.previous.kid) {
      return config.previous.secret
    }

    throw new Error('Unknown JWT key id')
  }

  if (config.legacyFallbackEnabled) return config.legacySecret

  throw new Error('JWT key id is required')
}

export const resolveAccessVerifySecret = (token: string): string =>
  resolveJwtVerifySecret(token, 'access')
