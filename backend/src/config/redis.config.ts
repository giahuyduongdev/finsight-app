import Redis from 'ioredis'
import { Env } from './env.config'

export const redis = new Redis(Env.REDIS_URL || 'redis://localhost:6379')

redis.on('connect', () => console.log('Connected to Redis'))
redis.on('error', (err) => console.error('Redis error:', err))
