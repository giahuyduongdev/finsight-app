import { redis } from '../config/redis.config'
import { logger } from '../config/logger.config'
import { logIcon, LOG_ICONS } from './logger-icon.util'

/**
 * Centralized helper to invalidate all analytics cache for a specific user.
 * Uses a non-blocking scanStream and unlink for performance.
 * Implements a bounded-chunk approach to process keys incrementally.
 */
export async function invalidateUserAnalyticsCache(
  userId: string | { toString(): string }
) {
  try {
    const id = userId?.toString()
    if (!id) return

    // Escape Redis glob characters to prevent injection
    const escapedId = id.replace(/[*?[\]]/g, '\\$&')
    const pattern = `analytics:*:${escapedId}:*`

    const stream = redis.scanStream({
      match: pattern,
      count: 100
    })

    let totalDeleted = 0
    let draining = Promise.resolve()

    return new Promise<void>((resolve) => {
      stream.on('data', (keys: string[]) => {
        // Stop scanning while we process the current chunk
        stream.pause()

        draining = draining
          .then(async () => {
            if (keys.length > 0) {
              // Non-blocking unlink for the current chunk (use array form)
              await redis.unlink(keys)
              totalDeleted += keys.length
            }
          })
          .then(() => {
            // Processing done, resume scanning for next chunk
            stream.resume()
          })
          .catch((err) => {
            logger.error(
              logIcon(
                LOG_ICONS.ERROR,
                `[Cache] Chunk invalidation failed for user ${id}`
              ),
              err
            )
            stream.resume() // Resume even on error
          })
      })

      stream.on('end', () => {
        // Wait for all in-flight chunks to finish before resolving
        draining
          .then(() => {
            if (totalDeleted > 0) {
              logger.info(
                logIcon(
                  LOG_ICONS.DELETE,
                  `[Cache] Invalidated ${totalDeleted} analytics keys for user ${id}`
                )
              )
            }
            resolve()
          })
          .catch((err) => {
            logger.error(
              logIcon(
                LOG_ICONS.ERROR,
                `[Cache] Final cache cleanup failed for user ${id}`
              ),
              err
            )
            resolve() // Still resolve to avoid crashing the caller
          })
      })

      stream.on('error', (err) => {
        logger.error(
          logIcon(LOG_ICONS.ERROR, `[Cache] Redis scan error for user ${id}`),
          err
        )
        resolve() // Resolve to avoid crashing the caller
      })
    })
  } catch (err) {
    logger.error(
      logIcon(LOG_ICONS.ERROR, '[Cache] Unexpected error during invalidation'),
      err
    )
  }
}
