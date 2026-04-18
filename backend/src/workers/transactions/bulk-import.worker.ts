import { Worker, Job } from 'bullmq'
import mongoose from 'mongoose'
import { bullMQConnection } from '../../config/bull/bullmq.config'
import { logger } from '../../config/logger.config'
import {
  TRANSACTION_JOBS,
  BulkImportJobData
} from '../../queues/transaction.queue'
import { redis } from '../../config/redis.config'

// Import 2 model cần thiết
import importBatchModel from '../../models/import-batch.model'
import TransactionModel from '../../models/transaction.model'

// ─── Handler ──────────────────────────────────────────────────────────────────

const processBulkImportJob = async (job: Job<BulkImportJobData>) => {
  const { userId, importBatchId } = job.data

  // 1. Nhặt được Job -> Cập nhật trạng thái thành PROCESSING ngay
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
  // Tăng BATCH_SIZE: 50 → 150 để giảm số lần roundtrip DB từ 6 xuống 2
  // insertMany 150 records/lần vẫn nằm trong giới hạn an toàn của MongoDB
  const BATCH_SIZE = 150
  let totalInserted = 0

  try {
    // 2. Chạy vòng lặp chia nhỏ (Chunking) để xử lý
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const chunk = transactions.slice(i, i + BATCH_SIZE)

      // Đảm bảo mọi giao dịch đều được gắn đúng chủ sở hữu (userId)
      const transactionsToInsert = chunk.map((tx: any) => ({
        ...tx,
        userId: new mongoose.Types.ObjectId(userId)
      }))

      // ordered: false → bỏ qua record lỗi thay vì dừng cả chunk
      const result = await TransactionModel.insertMany(transactionsToInsert, {
        ordered: false
      })
      totalInserted += result.length

      // Cập nhật % tiến độ cho BullMQ (Dành cho thanh Progress Bar trên UI sau này)
      await job.updateProgress(
        Math.round((totalInserted / transactions.length) * 100)
      )

      logger.info(
        `📦 [Worker] Batch ${Math.ceil((i + 1) / BATCH_SIZE)} done: ${totalInserted}/${transactions.length}`
      )
    }

    // 3. Xử lý trót lọt toàn bộ -> Một lần gọi DB duy nhất: COMPLETED + xóa data nặng
    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'COMPLETED',
      processedCount: totalInserted,
      $unset: { transactions: 1 } // Xóa mảng data nặng nề này đi
    })
    logger.info(`🗑️ [Worker] Cleaned up import batch: ${importBatchId}`)

    // 4. Invalidate analytics cache để dashboard hiển thị số liệu mới
    const keys = await redis.keys(`analytics:*:${userId}:*`)
    if (keys.length) await redis.del(...keys)

    return { insertedCount: totalInserted, success: true }
  } catch (error: any) {
    // 5. Lỗi giữa chừng (VD: Sai kiểu dữ liệu, sập DB) -> Cập nhật FAILED
    await importBatchModel.findByIdAndUpdate(importBatchId, {
      status: 'FAILED',
      processedCount: totalInserted
    })
    throw error // Ném lỗi ra để kích hoạt sự kiện 'failed' ở dưới
  }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const bulkImportWorker = new Worker<BulkImportJobData>(
  'TRANSACTION_QUEUE',
  async (job) => {
    if (job.name !== TRANSACTION_JOBS.BULK_IMPORT) return
    return await processBulkImportJob(job)
  },
  {
    connection: bullMQConnection,
    concurrency: 2 // Có thể gánh 2 file Excel cùng lúc
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

bulkImportWorker.on('completed', (job) => {
  const count = job.returnvalue?.insertedCount || 0
  logger.info(
    `✅ [Worker] Bulk import done: ${count} transactions for user: ${job.data.userId} (Batch: ${job.data.importBatchId})`
  )
})

bulkImportWorker.on('failed', (job, err) => {
  logger.error(
    `❌ [Worker] Bulk import failed for Batch: ${job?.data.importBatchId}`,
    {
      userId: job?.data.userId,
      error: err.message,
      attempt: job?.attemptsMade
    }
  )
})
