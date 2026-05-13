/**
 * Redis Database Connection
 * Handles Redis client connection, reconnection, and event listeners
 */

import Redis from 'ioredis'
import { redisConfig } from '../config/db.config'
import { logger } from '../config/logger.config'

class RedisDatabase {
  private static instance: RedisDatabase
  public client: Redis

  private constructor() {
    this.client = new Redis(redisConfig.url, {
      ...redisConfig.options,
      lazyConnect: false // Auto-connect on initialization
    })
    this.setupEventListeners()
  }

  /**
   * Setup Redis connection event listeners
   */
  private setupEventListeners(): void {
    this.client.on('connect', async () => {
      logger.info('[SYS:Redis] Connected successfully!')
    })

    this.client.on('error', (err: Error) =>
      logger.error('[SYS:Redis] Connection error', {
        message: err.message,
        stack: err.stack
      })
    )

    this.client.on('end', () => logger.warn('[SYS:Redis] Connection closed'))

    this.client.on('reconnecting', () =>
      logger.info('[SYS:Redis] Connection lost. Attempting to reconnect...')
    )
  }

  /**
   * Get Redis client instance (Singleton)
   */
  public static getInstance(): Redis {
    if (!RedisDatabase.instance) {
      RedisDatabase.instance = new RedisDatabase()
    }
    return RedisDatabase.instance.client
  }

  /**
   * Disconnect from Redis
   */
  public static async disconnect(): Promise<void> {
    if (RedisDatabase.instance) {
      await RedisDatabase.instance.client.quit()
      logger.info('[SYS:Redis] Disconnected')
    }
  }
}

export const redis = RedisDatabase.getInstance()
export { RedisDatabase }
