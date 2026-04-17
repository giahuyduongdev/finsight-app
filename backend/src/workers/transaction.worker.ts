import { Worker, Job } from 'bullmq'
import mongoose from 'mongoose'
import { format } from 'date-fns'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import { TRANSACTION_JOBS, RecurringJobData } from '../queues/transaction.queue'
import TransactionModel, {
  TransactionStatusEnum
} from '../models/transaction.model'
import { calculateNextOccurrence } from '../utils/dates/index'

// 1. Khởi tạo Worker
export const transactionWorker = new Worker<RecurringJobData>(
  'TRANSACTION_QUEUE',
  async (job: Job<RecurringJobData>) => {
    if (job.name !== TRANSACTION_JOBS.RECURRING) return

    const { transactionId } = job.data
    const now = new Date()

    // Lấy transaction ra check lại (đề phòng job bị kẹt lâu, điều kiện đã thay đổi)
    const tx = await TransactionModel.findOne({
      _id: transactionId,
      isRecurring: true,
      nextRecurringDate: { $lte: now } // Vẫn còn hạn
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
          // 1. Tạo child transaction
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

          // 2. Cập nhật parent transaction
          await TransactionModel.updateOne(
            { _id: tx._id },
            {
              $set: {
                nextRecurringDate: nextDate,
                lastProcessed: now
              }
            },
            { session }
          )
        },
        { maxCommitTimeMS: 20000 }
      )

      logger.info(`✅ [Worker] Processed recurring tx: ${transactionId}`)
    } finally {
      await session.endSession()
    }
  },
  {
    connection: bullMQConnection,
    concurrency: 5 // GIỚI HẠN: Chỉ cho phép xử lý 5 giao dịch cùng một lúc để bảo vệ DB
  }
)

transactionWorker.on('completed', (job) =>
  logger.info(`✅ Recurring tx processed: ${job.data.transactionId}`)
)

// 2. Xử lý sự kiện và "Poison Pill" (Ngắt khi lỗi quá nhiều lần)
transactionWorker.on('failed', async (job, err) => {
  logger.error(`❌ [Worker] Job ${job?.id} failed: ${err.message}`)

  // Nếu đã thử hết số lần cho phép (ví dụ 3 lần) mà vẫn lỗi -> Kích hoạt Poison Pill
  if (job && job.attemptsMade === job.opts.attempts) {
    try {
      await TransactionModel.updateOne(
        { _id: job.data.transactionId },
        {
          $set: {
            isRecurring: false,
            lastProcessed: new Date()
          }
        }
      )
      logger.info(
        `⏸️ [Poison Pill] Transaction errors have been continuously paused: ${job.data.transactionId}`
      )
    } catch (updateError: any) {
      logger.error(
        `CRITICAL: Cannot pause transaction ${job.data.transactionId}`,
        updateError?.message
      )
    }
  }
})
