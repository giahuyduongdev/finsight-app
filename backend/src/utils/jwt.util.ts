import jwt, { SignOptions } from 'jsonwebtoken'
import { Env } from '../config/env.config'

type TimeUnit = 's' | 'm' | 'h' | 'd' | 'w' | 'y'
type TimeString = `${number}${TimeUnit}`

export type AccessTokenPayload = {
  userId: string
}

type SignOptsAndSecret = SignOptions & {
  secret: string
  expiresIn?: TimeString | number
}

const defaults: SignOptions = {
  audience: ['user']
}

const accessTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_EXPIRES_IN as TimeString,
  secret: Env.JWT_SECRET
}

export const refreshTokenSignOptions: SignOptsAndSecret = {
  expiresIn: Env.JWT_REFRESH_EXPIRES_IN as TimeString,
  secret: Env.JWT_REFRESH_SECRET
}

export const signJwtToken = (
  payload: AccessTokenPayload,
  options?: SignOptsAndSecret
) => {
  const isAccessToken = !options || options === accessTokenSignOptions

  const { secret, ...opts } = options || accessTokenSignOptions

  const token = jwt.sign(payload, secret, {
    ...defaults,
    ...opts
  })

  const decoded = jwt.decode(token)

  if (isAccessToken) {
    if (!decoded || typeof decoded === 'string' || !decoded.exp) {
      throw new Error('Failed to sign token: missing expiration claim')
    }
    return {
      token,
      expiresAt: decoded.exp * 1000
    }
  }

  return {
    token,
    expiresAt: undefined
  }
}
