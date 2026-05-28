import crypto from 'crypto'
import { Env } from '../config/env.config'

const hmacSha256 = (value: string) =>
  crypto.createHmac('sha256', Env.TOKEN_HASH_SECRET).update(value).digest('hex')

export const hashOtp = hmacSha256

export const hashResetToken = hmacSha256

export const hashRefreshToken = hmacSha256
