import Redis from 'ioredis'
import { Env } from './env.config'
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'

export const redis = new Redis(Env.REDIS_URL || 'redis://localhost:6379')
// export const redis = new Redis(Env.UPSTASH_REDIS_URL)
redis.on('connect', () => console.log('Connected to Redis'))
redis.on('error', (err) => console.error('Redis error:', err))

// Rate limiter dùng chung redis instance
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // 100 request/15 phút
  skip: () => process.env.NODE_ENV === 'development',
  message: {
    message: 'Too many requests, please try again later',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as any
  })
})

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // 10 request/15 phút
  skip: () => process.env.NODE_ENV === 'development',
  message: {
    message: 'Too many auth attempts, please try again later',
    errorCode: 'RATE_LIMIT_EXCEEDED'
  },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as any
  })
})
