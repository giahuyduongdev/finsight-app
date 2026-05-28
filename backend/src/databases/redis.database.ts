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
      lazyConnect: true // Defer connection until explicitly needed
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
   * Connects lazily on first access
   */
  public static getInstance(): Redis {
    if (!RedisDatabase.instance) {
      RedisDatabase.instance = new RedisDatabase()
      // Connect explicitly since lazyConnect is true
      RedisDatabase.instance.client.connect().catch((err) => {
        logger.error('[SYS:Redis] Failed to connect', {
          message: err.message,
          stack: err.stack
        })
      })
    }
    return RedisDatabase.instance.client
  }

  /**
   * Disconnect from Redis with timeout
   */
  public static async disconnect(): Promise<void> {
    if (RedisDatabase.instance) {
      const disconnectPromise = RedisDatabase.instance.client.quit()
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(() => {
          logger.warn('[SYS:Redis] Disconnect timeout, forcing close')
          RedisDatabase.instance.client.disconnect()
          resolve()
        }, 5000)
      )

      await Promise.race([disconnectPromise, timeoutPromise])
      logger.info('[SYS:Redis] Disconnected')
    }
  }
}

export const redis = RedisDatabase.getInstance()
export { RedisDatabase }
