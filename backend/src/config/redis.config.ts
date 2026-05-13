/**
 * Redis Configuration
 * Redis keys, TTL constants, and rate limiters
 */

import rateLimit from 'express-rate-limit'
import RedisStore, { RedisReply } from 'rate-limit-redis'
import { redis } from '../databases/redis.database'
import { isDevelopment } from './app.config'

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

const RATE_LIMIT = {
  GLOBAL: 100,
  AUTH: 10
} as const

export const OTP_CONFIG = {
  MAX_ATTEMPTS: 5 // Tối đa 5 lần nhập sai
} as const

export const REDIS_KEYS = {
  // ─── REGISTER FLOW ──────────────────────────────────────────
  registerOtp: (email: string) => `otp:register:${email}`,
  registerPending: (email: string) => `pending:register:${email}`,
  registerResend: (email: string) => `resend:register:${email}`,
  registerAttempts: (email: string) => `attempts:register:${email}`, // ← Đếm số lần sai

  // ─── FORGOT PASSWORD FLOW ───────────────────────────────────
  forgotOtp: (email: string) => `otp:forgot:${email}`,
  forgotResend: (email: string) => `resend:forgot:${email}`,
  forgotAttempts: (email: string) => `attempts:forgot:${email}`, // ← Đếm số lần sai
  resetToken: (email: string) => `reset:forgot:token:${email}`,

  // ─── CHANGE PASSWORD FLOW ───────────────────────────────────
  changePasswordOtp: (email: string) => `otp:change-password:${email}`,
  changePasswordResend: (email: string) => `resend:change-password:${email}`,
  changePasswordAttempts: (email: string) =>
    `attempts:change-password:${email}`,
  changePasswordPending: (email: string) => `pending:change-password:${email}`,

  // ─── CHANGE EMAIL FLOW ──────────────────────────────────
  changeEmailOtpOld: (userId: string) => `otp:change-email:old:${userId}`,
  changeEmailOtpNew: (userId: string) => `otp:change-email:new:${userId}`,
  changeEmailPending: (userId: string) => `pending:change-email:${userId}`,
  changeEmailResend: (userId: string) => `resend:change-email:${userId}`,
  changeEmailAttempts: (userId: string) => `attempts:change-email:${userId}`
} as const

export const REDIS_TTL = {
  OTP: 5 * 60, // 5 phút
  PENDING: 15 * 60, // 15 phút
  RESEND: 60, // 1 phút
  OTP_ATTEMPTS: 15 * 60, // 15 phút

  // Forgot password
  FORGOT_OTP: 5 * 60, // 5 phút
  FORGOT_RESEND: 60, // 1 phút
  RESET_TOKEN: 10 * 60, // 10 phút

  // Change password
  CHANGE_PASSWORD_OTP: 5 * 60, // 5 phút
  CHANGE_PASSWORD_RESEND: 60, // 1 phút

  // Change email
  CHANGE_EMAIL_OTP: 5 * 60, // 5 phút
  CHANGE_EMAIL_RESEND: 60 // 1 phút
} as const

// Re-export redis client for backward compatibility
export { redis }

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const makeRedisStore = (prefix: string) =>
  new RedisStore({
    sendCommand: async (
      command: string,
      ...args: string[]
    ): Promise<RedisReply> =>
      redis.call(command, ...args) as Promise<RedisReply>,
    prefix
  })

export const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT.GLOBAL,
  skip: isDevelopment,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests, please try again later',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  },
  store: makeRedisStore('rl:global:')
})

export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT.AUTH,
  skip: isDevelopment,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many auth attempts, please try again later',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  },
  store: makeRedisStore('rl:auth:')
})
