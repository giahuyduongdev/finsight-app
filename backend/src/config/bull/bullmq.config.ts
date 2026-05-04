import Redis from 'ioredis'
import { Env } from '../env.config'
import { logger } from '../logger.config'
import { logIcon, LOG_ICONS } from '../../utils/logger-icon.util'

export const bullMQConnection = new Redis(Env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

bullMQConnection.on('connect', () =>
  logger.info(logIcon(LOG_ICONS.SUCCESS, '[BullMQ] Connected successfully!'))
)
bullMQConnection.on('error', (err) =>
  logger.error(
    logIcon(LOG_ICONS.ERROR, '[BullMQ] Connection error:'),
    err.message
  )
)
bullMQConnection.on('reconnecting', () =>
  logger.warn(
    logIcon(
      LOG_ICONS.WARNING,
      '[BullMQ] Connection lost. Attempting to reconnect...'
    )
  )
)
bullMQConnection.on('end', () =>
  logger.warn(logIcon(LOG_ICONS.STOP, '[BullMQ] Connection closed.'))
)
