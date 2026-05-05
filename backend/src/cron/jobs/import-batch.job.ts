import ImportBatchModel from '../../models/import-batch.model'
import { logger } from '../../config/logger.config'
import { logIcon, LOG_ICONS } from '../../utils/logger-icon.util'

/**
 * Cleanup stale import batches that are stuck in PENDING or PROCESSING state
 * Runs daily to mark old batches as FAILED so TTL can clean them up
 */
export const cleanupStaleImportBatches = async () => {
  try {
    logger.info(
      logIcon(LOG_ICONS.INFO, '[Cron] Cleaning up stale import batches...')
    )

    // Mark batches older than 7 days as FAILED
    // Use updatedAt to detect stale batches (no progress for 7 days)
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    const result = await ImportBatchModel.updateMany(
      {
        status: { $in: ['PENDING', 'PROCESSING'] },
        updatedAt: { $lt: threshold }
      },
      {
        status: 'FAILED',
        terminalAt: new Date() // Set terminalAt so TTL index will delete after 24h
      }
    )

    if (result.modifiedCount > 0) {
      logger.info(
        logIcon(
          LOG_ICONS.SUCCESS,
          `[Cron] Marked ${result.modifiedCount} stale import batches as FAILED`
        )
      )
    } else {
      logger.info(
        logIcon(LOG_ICONS.INFO, '[Cron] No stale import batches found')
      )
    }
  } catch (error) {
    logger.error(
      logIcon(LOG_ICONS.ERROR, '[Cron] Failed to cleanup stale import batches'),
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    )
  }
}
