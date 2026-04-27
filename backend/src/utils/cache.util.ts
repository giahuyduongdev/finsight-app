import { redis } from '../config/redis.config'
import { logger } from '../config/logger.config'

/**
 * Centralized helper to invalidate all analytics cache for a specific user.
 * Uses a non-blocking scanStream and unlink for performance.
 */
export async function invalidateUserAnalyticsCache(userId: string | { toString(): string }) {
  try {
    const id = userId?.toString()
    if (!id) return

    const pattern = `analytics:*:${id}:*`
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    })

    const keysToDelete: string[] = []

    return new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          keysToDelete.push(...keys)
        }
      })

      stream.on('end', async () => {
        try {
          if (keysToDelete.length > 0) {
            // Batch unlink to avoid overwhelming Redis or exceeding argument limits
            const BATCH_SIZE = 1000
            for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
              const batch = keysToDelete.slice(i, i + BATCH_SIZE)
              await redis.unlink(...batch)
            }
            logger.info(`🧹 [Cache] Invalidated ${keysToDelete.length} analytics keys for user ${id}`)
          }
          resolve()
        } catch (err) {
          logger.error(`❌ [Cache] Failed to unlink keys for user ${id}`, err)
          reject(err)
        }
      })

      stream.on('error', (err) => {
        logger.error(`❌ [Cache] Redis scan error for user ${id}`, err)
        reject(err)
      })
    })
  } catch (err) {
    logger.error('❌ [Cache] Unexpected error during invalidation', err)
  }
}
