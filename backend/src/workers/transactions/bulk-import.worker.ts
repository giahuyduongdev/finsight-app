import { Worker, Job } from 'bullmq'
import { bullMQConnection } from '../../config/bull/bullmq.config'
import { logger } from '../../config/logger.config'
import {
  TRANSACTION_JOBS,
  BulkImportJobData
} from '../../queues/transaction.queue'
import { bulkTransactionService } from '../../services/transaction.service'

// ─── Handler ──────────────────────────────────────────────────────────────────

const processBulkImportJob = async (job: Job<BulkImportJobData>) => {
  const { userId, transactions } = job.data
  const BATCH_SIZE = 50
  let totalInserted = 0

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE)
    const result = await bulkTransactionService(userId, batch)
    totalInserted += result.insertedCount

    await job.updateProgress(
      Math.round((totalInserted / transactions.length) * 100)
    )

    logger.info(
      `📦 [Worker] Batch ${Math.ceil((i + 1) / BATCH_SIZE)} done: ${totalInserted}/${transactions.length}`
    )
  }

  return { insertedCount: totalInserted, success: true }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const bulkImportWorker = new Worker<BulkImportJobData>(
  'TRANSACTION_QUEUE',
  async (job) => {
    if (job.name !== TRANSACTION_JOBS.BULK_IMPORT) return
    await processBulkImportJob(job)
  },
  {
    connection: bullMQConnection,
    concurrency: 2
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

bulkImportWorker.on('completed', (job) =>
  logger.info(
    `✅ [Worker] Bulk import done: ${job.data.transactions.length} transactions for user: ${job.data.userId}`
  )
)

bulkImportWorker.on('failed', (job, err) =>
  logger.error(`❌ [Worker] Bulk import failed`, {
    userId: job?.data.userId,
    error: err.message,
    attempt: job?.attemptsMade
  })
)
