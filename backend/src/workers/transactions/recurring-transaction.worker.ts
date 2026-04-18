import { Worker, Job } from 'bullmq'
import mongoose from 'mongoose'
import { format } from 'date-fns'
import { bullMQConnection } from '../../config/bull/bullmq.config'
import { logger } from '../../config/logger.config'
import {
  TRANSACTION_JOBS,
  RecurringJobData
} from '../../queues/transaction.queue'
import TransactionModel, {
  TransactionStatusEnum
} from '../../models/transaction.model'
import { calculateNextOccurrence } from '../../utils/dates/index'

// ─── Handler ──────────────────────────────────────────────────────────────────

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

export const recurringTransactionWorker = new Worker<RecurringJobData>(
  'TRANSACTION_QUEUE',
  async (job) => {
    if (job.name !== TRANSACTION_JOBS.RECURRING) return
    await processRecurringJob(job)
  },
  {
    connection: bullMQConnection,
    concurrency: 5
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

recurringTransactionWorker.on('completed', (job) =>
  logger.info(`✅ [Worker] Recurring tx processed: ${job.data.transactionId}`)
)

recurringTransactionWorker.on('failed', async (job, err) => {
  logger.error(`❌ [Worker] Job ${job?.id} failed: ${err.message}`)

  // Poison Pill: hết retry → tạm ngưng transaction
  if (job && job.attemptsMade === job.opts.attempts) {
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
