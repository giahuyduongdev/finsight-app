import Redis from 'ioredis'
import { Env } from '../env.config'
import { logger } from '../logger.config'

export const bullMQConnection = new Redis(Env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

bullMQConnection.on('connect', () =>
  logger.info('[SYS:BullMQ] Connected successfully!')
)
bullMQConnection.on('error', (err) =>
  logger.error('[SYS:BullMQ] Connection error:', err.message)
)
bullMQConnection.on('reconnecting', () =>
  logger.warn('[SYS:BullMQ] Connection lost. Attempting to reconnect...')
)
bullMQConnection.on('end', () => logger.warn('[SYS:BullMQ] Connection closed'))
