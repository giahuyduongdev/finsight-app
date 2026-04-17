import Redis from 'ioredis'
import { Env } from '../env.config'
import { logger } from '../logger.config'

export const bullMQConnection = new Redis(Env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

bullMQConnection.on('connect', () =>
  logger.info('🟢 [BullMQ] Connected successfully!')
)
bullMQConnection.on('error', (err) =>
  logger.error('❌ [BullMQ] Connection error:', err.message)
)
bullMQConnection.on('reconnecting', () =>
  logger.warn('🔴 [BullMQ] Connection lost! Waiting to reconnect......')
)
bullMQConnection.on('end', () =>
  logger.error('🟡 [BullMQ] Reconnected successfully!')
)
