import { Worker, Job, UnrecoverableError } from 'bullmq'
import mongoose from 'mongoose'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import {
  TRANSACTION_JOBS,
  BulkImportJobData,
  RecurringJobData
} from '../queues/transaction.queue'
import { getIO } from '../config/socket.config'
import { invalidateUserAnalyticsCache } from '../utils/cache.util'

import TransactionModel, {
  TransactionStatusEnum,
  TransactionDocument
} from '../models/transaction.model'
import { calculateNextOccurrence } from '../utils/dates/index'
import { container } from '../container'
import { getJobAttemptContext } from '../utils/bullmq/job-reliability.util'

function isBulkWriteError(
  error: unknown
): error is { insertedCount: number; result?: { nInserted: number } } {
  return (
    error !== null &&
    typeof error === 'object' &&
    ('insertedCount' in error ||
      ('result' in error &&
        error.result !== null &&
        typeof error.result === 'object' &&
        'nInserted' in error.result))
  )
}

function isMongoDuplicateKeyError(error: unknown): error is { code: 11000 } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 11000
  )
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Xử lý Import hàng loạt giao dịch
 */
export const processBulkImportJob = async (job: Job<BulkImportJobData>) => {
  const { userId, importBatchId } = job.data

  // Get repositories from DI container
  const importBatchRepository = container.getImportBatchRepository()
  const transactionRepository = container.getTransactionRepository()

  const existingBatch = await importBatchRepository.findById(importBatchId)

  if (!existingBatch) {
    logger.warn(`[JOB:Transaction] Import batch ${importBatchId} not found`)
    throw new UnrecoverableError(`Import batch not found: ${importBatchId}`)
  }

  if (existingBatch.status === 'COMPLETED') {
    return {
      status: 'skipped',
      reason: 'import-batch-already-completed',
      details: { importBatchId }
    }
  }

  if (existingBatch.status === 'FAILED') {
    throw new UnrecoverableError(
      `Import batch is already terminal: ${importBatchId}`
    )
  }

  const batchDoc =
    existingBatch.status === 'PENDING'
      ? await importBatchRepository.claimForProcessing(importBatchId)
      : existingBatch

  if (!batchDoc) {
    throw new Error(`Failed to claim import batch: ${importBatchId}`)
  }

  const { transactions } = batchDoc
  const BATCH_SIZE = 150
  let totalProcessed = batchDoc.processedCount
  let rejectedCount = batchDoc.rejectedCount
  let totalInserted = totalProcessed - rejectedCount

  // Lấy io instance để emit progress
  let io: ReturnType<typeof getIO> | null = null
  try {
    io = getIO()
  } catch (error) {
    logger.warn('[JOB:Transaction] Socket not initialized, skipping emit', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  for (
    let i = batchDoc.processedCount;
    i < transactions.length;
    i += BATCH_SIZE
  ) {
    const chunk = transactions.slice(i, i + BATCH_SIZE)

    const transactionsToInsert = chunk
      .map((tx, chunkIndex) => {
        // Reject rows without a date or with an invalid date
        if (!tx.date) return null

        const parsedDate = new Date(tx.date)
        if (isNaN(parsedDate.getTime())) return null

        const cleanUserId =
          typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : (userId as unknown as mongoose.Types.ObjectId)

        return {
          ...tx,
          userId: cleanUserId,
          date: parsedDate,
          status: tx.status || TransactionStatusEnum.COMPLETED, // Tôn trọng status người dùng đã sửa, mặc định là COMPLETED
          recurringSourceId: undefined,
          importBatchId: new mongoose.Types.ObjectId(importBatchId),
          importRowIndex: i + chunkIndex
        }
      })
      .filter((tx) => tx !== null) as Partial<TransactionDocument>[]

    let insertedInThisBatch = 0
    let databaseRejections = 0
    if (transactionsToInsert.length > 0) {
      try {
        const result =
          await transactionRepository.bulkCreate(transactionsToInsert)
        insertedInThisBatch = result.insertedCount
      } catch (error: unknown) {
        if (isBulkWriteError(error)) {
          insertedInThisBatch =
            error.result?.nInserted ?? error.insertedCount ?? 0
          databaseRejections = transactionsToInsert.length - insertedInThisBatch
          logger.warn(
            `[JOB:Transaction] Partial success in bulk insert: ${insertedInThisBatch} inserted, ${databaseRejections} rejected by DB`
          )
        } else {
          // Re-throw serious errors (connection, etc.) so BullMQ can retry.
          // insertedInThisBatch remains 0 as initialized at line 82.
          throw error
        }
      }
    }

    const validationRejections = chunk.length - transactionsToInsert.length
    totalProcessed += chunk.length
    rejectedCount += validationRejections + databaseRejections
    totalInserted = totalProcessed - rejectedCount

    await importBatchRepository.updateProgress(
      importBatchId,
      totalProcessed,
      rejectedCount
    )

    const progress = Math.round((totalProcessed / transactions.length) * 100)
    await job.updateProgress(progress)

    // Emit progress qua Socket.IO
    io?.to(userId.toString()).emit('bulk-import:progress', {
      progress,
      totalProcessed,
      totalInserted,
      rejectedCount,
      total: transactions.length
    })

    logger.info(
      `[JOB:Transaction] Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: Processed ${totalProcessed}/${transactions.length} (Inserted: ${totalInserted}, Rejected: ${rejectedCount})`
    )
  }

  await importBatchRepository.updateStatus(
    importBatchId,
    'COMPLETED',
    new Date()
  )
  await importBatchRepository.removeTransactionsArray(importBatchId)
  logger.info(`[JOB:Transaction] Cleaned up import batch: ${importBatchId}`)

  // Xóa cache analytics của user
  await invalidateUserAnalyticsCache(userId)

  //  Emit completed
  const room = userId.toString()
  logger.info(
    `[JOB:Transaction] Emitting bulk-import:completed to room: ${room}`
  )

  try {
    io?.to(room).emit('bulk-import:completed', {
      totalInserted,
      rejectedCount,
      totalProcessed,
      message: `Successfully imported ${totalInserted} transactions${rejectedCount > 0 ? ` (${rejectedCount} rejected)` : ''}`
    })
  } catch (error) {
    logger.error('[JOB:Transaction] Failed to emit completion event', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  return { insertedCount: totalInserted, rejectedCount, success: true }
}

/**
 * Xử lý Giao dịch định kỳ
 */
/**
 * Xử lý Từng mẻ giao dịch định kỳ (Job CON)
 */
export const processRecurringChildJob = async (job: Job<RecurringJobData>) => {
  const { transactionIds, userId } = job.data
  const now = new Date()

  if (!transactionIds || !transactionIds.length) {
    logger.warn(
      `[JOB:Transaction] No transactionIds in job data for user ${userId}`
    )
    return
  }

  let processedCount = 0
  let skippedCount = 0

  for (const transactionId of transactionIds) {
    const session = await mongoose.startSession()
    let occurrenceDateForVerification: Date | undefined

    try {
      await session.withTransaction(async () => {
        const source = await TransactionModel.findOne({
          _id: transactionId,
          userId,
          isRecurring: true,
          nextRecurringDate: { $lte: now }
        }).session(session)

        if (!source?.nextRecurringDate || !source.recurringInterval) {
          skippedCount += 1
          return
        }

        const occurrenceDate = source.nextRecurringDate
        occurrenceDateForVerification = occurrenceDate
        const nextDate = calculateNextOccurrence(
          occurrenceDate,
          source.recurringInterval
        )
        const existingOccurrence = await TransactionModel.findOne({
          recurringSourceId: source._id,
          date: occurrenceDate
        }).session(session)

        if (!existingOccurrence) {
          await TransactionModel.create(
            [
              {
                userId: source.userId,
                title: source.title,
                amount: source.amount,
                type: source.type,
                category: source.category,
                description: source.description,
                date: occurrenceDate,
                currency: source.currency,
                paymentMethod: source.paymentMethod,
                status: source.status || TransactionStatusEnum.COMPLETED,
                isRecurring: false,
                recurringSourceId: source._id
              }
            ],
            { session }
          )
        }

        const updateResult = await TransactionModel.updateOne(
          {
            _id: source._id,
            userId,
            nextRecurringDate: occurrenceDate
          },
          {
            $set: {
              nextRecurringDate: nextDate,
              lastProcessed: now
            }
          },
          { session }
        )

        if (updateResult.modifiedCount === 0) {
          skippedCount += 1
          return
        }

        if (existingOccurrence) {
          skippedCount += 1
        } else {
          processedCount += 1
        }
      })
    } catch (error) {
      if (isMongoDuplicateKeyError(error) && occurrenceDateForVerification) {
        const occurrenceExists = await TransactionModel.exists({
          recurringSourceId: transactionId,
          date: occurrenceDateForVerification
        })

        if (!occurrenceExists) {
          throw error
        }

        skippedCount += 1
        logger.info('[JOB:Transaction] Recurring occurrence already exists', {
          transactionId,
          userId
        })
        continue
      }

      logger.error(
        `[JOB:Transaction] Failed to process recurring occurrence for ${userId}`,
        {
          transactionId,
          error: error instanceof Error ? error.message : String(error)
        }
      )
      throw error
    } finally {
      await session.endSession()
    }
  }

  logger.info(
    `[JOB:Transaction] Batch Processed: ${processedCount} created, ${skippedCount} skipped for user ${userId}`
  )

  return {
    status: processedCount > 0 ? 'succeeded' : 'skipped',
    ...(processedCount === 0
      ? { reason: 'recurring-occurrences-already-processed' }
      : {}),
    details: { processedCount, skippedCount }
  }
}

/**
 * Xử lý Tổng kết Giao dịch định kỳ (Job CHA)
 */
const processRecurringSummaryJob = async (job: Job<RecurringJobData>) => {
  const { userId } = job.data
  // BullMQ Flows cho phép truy cập kết quả của các job con nếu cần,
  // nhưng ở đây ta chỉ cần biết là tất cả đã xong để bắn báo cáo.

  try {
    const io = getIO()
    io.to(userId).emit('recurring-transaction:processed', {
      message: `The system has processed your recurring transactions.`
    })
  } catch (error) {
    logger.error('[JOB:Transaction] Failed to emit recurring summary event', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  logger.info(`[JOB:Transaction] Parent Summary Processed for user: ${userId}`)
  return { success: true, userId, timestamp: new Date().toISOString() }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const transactionWorker = new Worker(
  'TRANSACTION_QUEUE',
  async (job) => {
    switch (job.name) {
      case TRANSACTION_JOBS.BULK_IMPORT:
        return await processBulkImportJob(job as Job<BulkImportJobData>)
      case TRANSACTION_JOBS.RECURRING:
        return await processRecurringChildJob(job as Job<RecurringJobData>)
      case TRANSACTION_JOBS.RECURRING_SUMMARY:
        return await processRecurringSummaryJob(job as Job<RecurringJobData>)
      default:
        logger.error(`[JOB:Transaction] Unknown job name: ${job.name}`)
        throw new Error(`Unknown job name: ${job.name}`)
    }
  },
  {
    connection: bullMQConnection,
    concurrency: 3 // Mỗi worker xử lý 200 txs một lúc nên hạ xuống 3 để tránh nghẽn DB
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

transactionWorker.on('completed', (job) => {
  if (job.name === TRANSACTION_JOBS.BULK_IMPORT) {
    const count = job.returnvalue?.insertedCount || 0
    logger.info(
      `[JOB:Transaction] Bulk import done: ${count} transactions for user: ${job.data.userId}`
    )
  } else if (job.name === TRANSACTION_JOBS.RECURRING) {
    logger.info(
      `[JOB:Transaction] Recurring batch processed: ${job.data.transactionIds?.length} txs`
    )
  }
})

transactionWorker.on('failed', async (job, err) => {
  logger.error(
    `[JOB:Transaction] Job ${job?.id} (${job?.name}) failed: ${err.message}`
  )

  if (
    job?.name === TRANSACTION_JOBS.BULK_IMPORT &&
    getJobAttemptContext(job).isFinalAttempt
  ) {
    const importBatchRepository = container.getImportBatchRepository()
    await importBatchRepository.updateStatus(
      job.data.importBatchId,
      'FAILED',
      new Date()
    )

    try {
      getIO().to(job.data.userId.toString()).emit('bulk-import:failed', {
        message: 'Import failed, please try again'
      })
    } catch (emitError) {
      logger.error('[JOB:Transaction] Failed to emit terminal failure event', {
        error:
          emitError instanceof Error ? emitError.message : String(emitError)
      })
    }
  }

  // Xử lý Poison Pill cho Recurring nếu cần
  if (
    job?.name === TRANSACTION_JOBS.RECURRING &&
    job.attemptsMade === job.opts.attempts &&
    job.data.transactionIds
  ) {
    try {
      // NOTE: Using TransactionModel directly for bulk update (poison pill edge case)
      // Repository pattern doesn't have updateMany method yet
      // Tạm dừng toàn bộ mẻ này nếu đã thử lại nhiều lần mà vẫn fail
      await TransactionModel.updateMany(
        { _id: { $in: job.data.transactionIds } },
        { $set: { isRecurring: false, lastProcessed: new Date() } }
      )
      logger.info(
        `[JOB:Transaction] Poison pill - Batch paused: ${job.data.transactionIds.length} transactions`
      )
    } catch (updateError) {
      const error = updateError as Error
      logger.error(`[JOB:Transaction] CRITICAL: Cannot pause recurring batch`, {
        error: error?.message
      })
    }
  }
})

transactionWorker.on('error', (error) => {
  logger.error('[SYS:BullMQ] Transaction worker infrastructure error', {
    queueName: 'TRANSACTION_QUEUE',
    eventType: 'error',
    error: error.message,
    stack: error.stack
  })
})
