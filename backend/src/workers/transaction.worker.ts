import { Worker, Job } from 'bullmq'
import mongoose from 'mongoose'
import { format } from 'date-fns'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import {
  TRANSACTION_JOBS,
  BulkImportJobData,
  RecurringJobData
} from '../queues/transaction.queue'
import { redis } from '../config/redis.config'
import { getIO } from '../config/socket.config'

import importBatchModel from '../models/import-batch.model'
import TransactionModel, {
  TransactionStatusEnum
} from '../models/transaction.model'
import { calculateNextOccurrence } from '../utils/dates/index'

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Xử lý Import hàng loạt giao dịch
 */
const processBulkImportJob = async (job: Job<BulkImportJobData>) => {
  const { userId, importBatchId } = job.data

  const batchDoc = await importBatchModel.findByIdAndUpdate(
    importBatchId,
    { status: 'PROCESSING' },
    { new: true }
  )

  if (!batchDoc) {
    logger.warn(`⚠️ Import batch ${importBatchId} not found`)
    return { insertedCount: 0, success: false }
  }

  const { transactions } = batchDoc
  const BATCH_SIZE = 150
  let totalInserted = 0

  // 👇 Lấy io instance để emit progress
  let io: ReturnType<typeof getIO> | null = null
  try {
    io = getIO()
  } catch {
    logger.warn('⚠️ [Worker] Socket not initialized, skipping emit')
  }

  try {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const chunk = transactions.slice(i, i + BATCH_SIZE)

      const transactionsToInsert = chunk.map((tx: any) => ({
        ...tx,
        userId: new mongoose.Types.ObjectId(userId)
      }))

      const result = await TransactionModel.insertMany(transactionsToInsert, {
        ordered: false
      })
      totalInserted += result.length

      const progress = Math.round((totalInserted / transactions.length) * 100)
      await job.updateProgress(progress)

      // Emit progress qua Socket.IO
      io?.to(userId.toString()).emit('bulk-import:progress', {
        progress,
        totalInserted,
        total: transactions.length
      })

      logger.info(
        `📦 [Worker] Batch ${Math.ceil((i + 1) / BATCH_SIZE)} done: ${totalInserted}/${transactions.length}`
      )
    }

    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'COMPLETED',
      processedCount: totalInserted,
      $unset: { transactions: 1 }
    })
    logger.info(`🗑️ [Worker] Cleaned up import batch: ${importBatchId}`)

    // Xóa cache analytics của user
    const keys = await redis.keys(`analytics:*:${userId}:*`)
    if (keys.length) await redis.del(...keys)

    //  Emit completed
    const room = userId.toString()
    logger.info(`📣 [Worker] Emitting bulk-import:completed to room: ${room}`)
    io?.to(room).emit('bulk-import:completed', {
      totalInserted,
      message: `Successfully imported ${totalInserted} transactions`
    })

    return { insertedCount: totalInserted, success: true }
  } catch (error: any) {
    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'FAILED',
      processedCount: totalInserted
    })

    // Emit failed
    io?.to(userId.toString()).emit('bulk-import:failed', {
      message: 'Import failed, please try again'
    })

    throw error
  }
}

/**
 * Xử lý Giao dịch định kỳ
 */
const processRecurringJob = async (job: Job<RecurringJobData>) => {
  const { transactionId } = job.data
  const now = new Date()

  const tx = await TransactionModel.findOne({
    _id: transactionId,
    isRecurring: true,
    nextRecurringDate: { $lte: now }
  })

  if (!tx) {
    logger.warn(
      `⚠️ Transaction ${transactionId} not found or already processed`
    )
    return
  }

  const nextDate = calculateNextOccurrence(
    tx.nextRecurringDate!,
    tx.recurringInterval!
  )

  const session = await mongoose.startSession()
  try {
    await session.withTransaction(
      async () => {
        await TransactionModel.create(
          [
            {
              ...tx.toObject(),
              _id: new mongoose.Types.ObjectId(),
              title: `${tx.title} - ${format(tx.nextRecurringDate!, 'MMM yyyy')}`,
              date: tx.nextRecurringDate,
              isRecurring: false,
              recurringSourceId: tx._id,
              status: TransactionStatusEnum.PENDING,
              nextRecurringDate: null,
              recurringInterval: null,
              lastProcessed: null,
              createdAt: undefined,
              updatedAt: undefined
            }
          ],
          { session }
        )

        await TransactionModel.updateOne(
          { _id: tx._id },
          { $set: { nextRecurringDate: nextDate, lastProcessed: now } },
          { session }
        )
      },
      { maxCommitTimeMS: 20000 }
    )

    logger.info(`✅ [Worker] Processed recurring tx: ${transactionId}`)
  } finally {
    await session.endSession()
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const transactionWorker = new Worker(
  'TRANSACTION_QUEUE',
  async (job) => {
    switch (job.name) {
      case TRANSACTION_JOBS.BULK_IMPORT:
        return await processBulkImportJob(job as Job<BulkImportJobData>)
      case TRANSACTION_JOBS.RECURRING:
        return await processRecurringJob(job as Job<RecurringJobData>)
      default:
        logger.warn(`❓ [Worker] Unknown job name: ${job.name}`)
    }
  },
  {
    connection: bullMQConnection,
    concurrency: 5 // Tăng nhẹ concurrency để xử lý song song tốt hơn
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

transactionWorker.on('completed', (job) => {
  if (job.name === TRANSACTION_JOBS.BULK_IMPORT) {
    const count = job.returnvalue?.insertedCount || 0
    logger.info(
      `✅ [Worker] Bulk import done: ${count} transactions for user: ${job.data.userId}`
    )
  } else if (job.name === TRANSACTION_JOBS.RECURRING) {
    logger.info(`✅ [Worker] Recurring tx processed: ${job.data.transactionId}`)
  }
})

transactionWorker.on('failed', async (job, err) => {
  logger.error(
    `❌ [Worker] Job ${job?.id} (${job?.name}) failed: ${err.message}`
  )

  // Xử lý Poison Pill cho Recurring nếu cần
  if (
    job?.name === TRANSACTION_JOBS.RECURRING &&
    job.attemptsMade === job.opts.attempts
  ) {
    try {
      await TransactionModel.updateOne(
        { _id: job.data.transactionId },
        { $set: { isRecurring: false, lastProcessed: new Date() } }
      )
      logger.info(
        `⏸️ [Poison Pill] Transaction paused: ${job.data.transactionId}`
      )
    } catch (updateError: any) {
      logger.error(
        `CRITICAL: Cannot pause transaction ${job.data.transactionId}`,
        updateError?.message
      )
    }
  }
})
