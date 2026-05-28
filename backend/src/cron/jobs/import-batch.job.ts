import { logger } from '../../config/logger.config'
import { container } from '../../container'

/**
 * Cleanup stale import batches that are stuck in PENDING or PROCESSING state
 * Runs daily to mark old batches as FAILED so TTL can clean them up
 */
export const cleanupStaleImportBatches = async () => {
  try {
    logger.info('[JOB:Cron] Cleaning up stale import batches...')

    // Get ImportBatchRepository from DI container
    const importBatchRepository = container.getImportBatchRepository()

    // Mark batches older than 7 days as FAILED
    // Use updatedAt to detect stale batches (no progress for 7 days)
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago

    // Find stale batches
    const staleBatches = await importBatchRepository.findStale(threshold)

    if (staleBatches.length > 0) {
      // Update each stale batch to FAILED status
      await Promise.all(
        staleBatches.map((batch) =>
          importBatchRepository.updateStatus(batch._id.toString(), 'FAILED')
        )
      )

      logger.info(
        `[JOB:Cron] Marked ${staleBatches.length} stale import batches as FAILED`
      )
    } else {
      logger.info('[JOB:Cron] No stale import batches found')
    }
  } catch (error) {
    logger.error('[JOB:Cron] Failed to cleanup stale import batches', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
