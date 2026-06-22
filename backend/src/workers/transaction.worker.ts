import { Worker, Job } from 'bullmq'
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

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Xử lý Import hàng loạt giao dịch
 */
const processBulkImportJob = async (job: Job<BulkImportJobData>) => {
  const { userId, importBatchId } = job.data

  // Get repositories from DI container
  const importBatchRepository = container.getImportBatchRepository()
  const transactionRepository = container.getTransactionRepository()

  const batchDoc = await importBatchRepository.updateStatus(
    importBatchId,
    'PROCESSING'
  )

  if (!batchDoc) {
    logger.warn(`[JOB:Transaction] Import batch ${importBatchId} not found`)
    return { insertedCount: 0, success: false }
  }

  const { transactions } = batchDoc
  const BATCH_SIZE = 150
  let totalProcessed = 0
  let totalInserted = 0
  let rejectedCount = 0

  // Lấy io instance để emit progress
  let io: ReturnType<typeof getIO> | null = null
  try {
    io = getIO()
  } catch (error) {
    logger.warn('[JOB:Transaction] Socket not initialized, skipping emit', {
      error: error instanceof Error ? error.message : String(error)
    })
  }

  try {
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const chunk = transactions.slice(i, i + BATCH_SIZE)

      const transactionsToInsert = chunk
        .map((tx) => {
          // Reject rows without a date or with an invalid date
          if (!tx.date) return null

          const parsedDate = new Date(tx.date)
          if (isNaN(parsedDate.getTime())) return null

          const cleanUserId =
            typeof userId === 'string' &&
            mongoose.Types.ObjectId.isValid(userId)
              ? new mongoose.Types.ObjectId(userId)
              : (userId as unknown as mongoose.Types.ObjectId)

          return {
            ...tx,
            userId: cleanUserId,
            date: parsedDate,
            status: tx.status || TransactionStatusEnum.COMPLETED, // Tôn trọng status người dùng đã sửa, mặc định là COMPLETED
            recurringSourceId: undefined
          }
        })
        .filter((tx) => tx !== null) as Partial<TransactionDocument>[]

      let insertedInThisBatch = 0
      if (transactionsToInsert.length > 0) {
        try {
          const result =
            await transactionRepository.bulkCreate(transactionsToInsert)
          insertedInThisBatch = result.insertedCount
        } catch (error: unknown) {
          if (isBulkWriteError(error)) {
            insertedInThisBatch =
              error.result?.nInserted ?? error.insertedCount ?? 0
            const dbRejections =
              transactionsToInsert.length - insertedInThisBatch
            logger.warn(
              `[JOB:Transaction] Partial success in bulk insert: ${insertedInThisBatch} inserted, ${dbRejections} rejected by DB`
            )
          } else {
            // Re-throw serious errors (connection, etc.) so BullMQ can retry.
            // insertedInThisBatch remains 0 as initialized at line 82.
            throw error
          }
        }
      }

      const validationRejections = chunk.length - transactionsToInsert.length
      totalInserted += insertedInThisBatch
      totalProcessed += chunk.length
      rejectedCount +=
        validationRejections +
        (transactionsToInsert.length - insertedInThisBatch)

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

    await importBatchRepository.updateStatus(importBatchId, 'COMPLETED')
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
  } catch (error) {
    await importBatchRepository.updateStatus(importBatchId, 'FAILED')

    // Emit failed
    try {
      io?.to(userId.toString()).emit('bulk-import:failed', {
        message: 'Import failed, please try again'
      })
    } catch (error) {
      logger.error('[JOB:Transaction] Failed to emit failure event', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    throw error
  }
}

/**
 * Xử lý Giao dịch định kỳ
 */
/**
 * Xử lý Từng mẻ giao dịch định kỳ (Job CON)
 */
const processRecurringChildJob = async (job: Job<RecurringJobData>) => {
  const { transactionIds, userId } = job.data
  const now = new Date()

  if (!transactionIds || !transactionIds.length) {
    logger.warn(
      `[JOB:Transaction] No transactionIds in job data for user ${userId}`
    )
    return
  }

  // Get TransactionRepository from DI container
  const transactionRepository = container.getTransactionRepository()

  // Tìm nạp toàn bộ TX trong mẻ này
  const allDueTransactions = await transactionRepository.findRecurringDue(now)

  // Filter by transactionIds
  const transactions = allDueTransactions.filter((tx) =>
    transactionIds.includes(tx._id.toString())
  )

  if (!transactions.length) {
    logger.warn(
      `[JOB:Transaction] No due transactions found in DB for batch of ${transactionIds.length} ids (User: ${userId})`
    )
    return
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    for (const tx of transactions) {
      const nextDate = calculateNextOccurrence(
        tx.nextRecurringDate!,
        tx.recurringInterval!
      )

      // 1. Tạo giao dịch mới
      await transactionRepository.create({
        userId: tx.userId,
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description,
        date: tx.nextRecurringDate!,
        currency: tx.currency,
        paymentMethod: tx.paymentMethod,
        status: tx.status || TransactionStatusEnum.COMPLETED,
        isRecurring: false,
        recurringSourceId: tx._id // Fix: dùng đúng trường recurringSourceId thay vì parentId
      })

      // 2. Cập nhật ngày tiếp theo cho bản mẫu
      await transactionRepository.update(
        tx._id.toString(),
        tx.userId.toString(),
        {
          nextRecurringDate: nextDate
        }
      )
    }

    await session.commitTransaction()
    logger.info(
      `[JOB:Transaction] Batch Processed: ${transactions.length} txs for user ${userId}`
    )
  } catch (error) {
    await session.abortTransaction()
    logger.error(
      `[JOB:Transaction] Failed to process child batch for ${userId}`,
      { error: error instanceof Error ? error.message : String(error) }
    )
    throw error
  } finally {
    session.endSession()
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
