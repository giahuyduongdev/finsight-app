import { Worker, Job } from 'bullmq'
import mongoose from 'mongoose'
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
  let totalProcessed = 0
  let totalInserted = 0
  let rejectedCount = 0

  // Lấy io instance để emit progress
  let io: ReturnType<typeof getIO> | null = null
  try {
    io = getIO()
  } catch {
    logger.warn('⚠️ [Worker] Socket not initialized, skipping emit')
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

          const cleanUserId = typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId

          return {
            ...tx,
            userId: cleanUserId,
            date: parsedDate,
            status: tx.status || TransactionStatusEnum.COMPLETED, // Tôn trọng status người dùng đã sửa, mặc định là COMPLETED
            recurringSourceId: null
          }
        })
        .filter((tx) => tx !== null)

      let insertedInThisBatch = 0
      if (transactionsToInsert.length > 0) {
        try {
          const result = await TransactionModel.insertMany(transactionsToInsert, {
            ordered: false
          })
          insertedInThisBatch = result.length
        } catch (error) {
          const err = error as { insertedCount?: number }
          // MongoDB driver v4+ uses insertedCount on BulkWriteError
          insertedInThisBatch = err.insertedCount ?? 0
          const dbRejections = transactionsToInsert.length - insertedInThisBatch
          logger.warn(`⚠️ [Worker] Partial success in bulk insert: ${insertedInThisBatch} inserted, ${dbRejections} rejected by DB`)
        }
      }

      const validationRejections = chunk.length - transactionsToInsert.length
      totalInserted += insertedInThisBatch
      totalProcessed += chunk.length
      rejectedCount += (validationRejections + (transactionsToInsert.length - insertedInThisBatch))

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
        `📦 [Worker] Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: Processed ${totalProcessed}/${transactions.length} (Inserted: ${totalInserted}, Rejected: ${rejectedCount})`
      )
    }

    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'COMPLETED',
      processedCount: totalProcessed,
      rejectedCount: rejectedCount,
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
      rejectedCount,
      totalProcessed,
      message: `Successfully imported ${totalInserted} transactions${rejectedCount > 0 ? ` (${rejectedCount} rejected)` : ''}`
    })

    return { insertedCount: totalInserted, rejectedCount, success: true }
  } catch (error) {
    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'FAILED',
      processedCount: totalProcessed,
      rejectedCount: rejectedCount
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
/**
 * Xử lý Từng mẻ giao dịch định kỳ (Job CON)
 */
const processRecurringChildJob = async (job: Job<RecurringJobData>) => {
  const { transactionIds, userId } = job.data
  const now = new Date()

  if (!transactionIds || !transactionIds.length) {
    logger.warn(`⚠️ [Worker] No transactionIds in job data for user ${userId}`)
    return
  }

  // Tìm nạp toàn bộ TX trong mẻ này
  const transactions = await TransactionModel.find({
    _id: { $in: transactionIds },
    isRecurring: true,
    nextRecurringDate: { $lte: now }
  })

  if (!transactions.length) {
    logger.warn(
      `⚠️ [Worker] No due transactions found in DB for batch of ${transactionIds.length} ids (User: ${userId})`
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
      await TransactionModel.create(
        [
          {
            userId: tx.userId,
            title: tx.title,
            amount: tx.amount,
            type: tx.type,
            category: tx.category,
            description: tx.description,
            date: tx.nextRecurringDate,
            currency: tx.currency,
            paymentMethod: tx.paymentMethod,
            status: tx.status || TransactionStatusEnum.COMPLETED,
            isRecurring: false,
            recurringSourceId: tx._id // Fix: dùng đúng trường recurringSourceId thay vì parentId
          }
        ],
        { session }
      )

      // 2. Cập nhật ngày tiếp theo cho bản mẫu
      await TransactionModel.findByIdAndUpdate(
        tx._id,
        { nextRecurringDate: nextDate },
        { session }
      )
    }

    await session.commitTransaction()
    logger.info(
      `✅ [Worker] Batch Processed: ${transactions.length} txs for user ${userId}`
    )
  } catch (error) {
    await session.abortTransaction()
    logger.error(`❌ [Worker] Failed to process child batch for ${userId}`, error)
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

  const io = getIO()
  io.to(userId).emit('recurring-transaction:processed', {
    message: `The system has processed your recurring transactions.`
  })

  logger.info(`📣 [Worker] Parent Summary Processed for user: ${userId}`)
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
        logger.warn(`❓ [Worker] Unknown job name: ${job.name}`)
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
      `✅ [Worker] Bulk import done: ${count} transactions for user: ${job.data.userId}`
    )
  } else if (job.name === TRANSACTION_JOBS.RECURRING) {
    logger.info(
      `✅ [Worker] Recurring batch processed: ${job.data.transactionIds?.length} txs`
    )
  }
})

transactionWorker.on('failed', async (job, err) => {
  logger.error(
    `❌ [Worker] Job ${job?.id} (${job?.name}) failed: ${err.message}`
  )

  // Xử lý Poison Pill cho Recurring nếu cần
  if (
    job?.name === TRANSACTION_JOBS.RECURRING &&
    job.attemptsMade === job.opts.attempts &&
    job.data.transactionIds
  ) {
    try {
      // Tạm dừng toàn bộ mẻ này nếu đã thử lại nhiều lần mà vẫn fail
      await TransactionModel.updateMany(
        { _id: { $in: job.data.transactionIds } },
        { $set: { isRecurring: false, lastProcessed: new Date() } }
      )
      logger.info(
        `⏸️ [Poison Pill] Batch paused: ${job.data.transactionIds.length} transactions`
      )
    } catch (updateError) {
      const error = updateError as Error
      logger.error(
        `CRITICAL: Cannot pause recurring batch`,
        error?.message
      )
    }
  }
})
