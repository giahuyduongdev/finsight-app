import TransactionModel from '../../models/transaction.model'
import {
  transactionQueue,
  TRANSACTION_JOBS
} from '../../queues/transaction.queue'
import { logger } from '../../config/logger.config'

export const processRecurringTransactions = async () => {
  const now = new Date()
  logger.info('🚀 Enqueuing recurring transactions...')

  try {
    // 1. Chọc vào Database (Có thể rủi ro lỗi kết nối DB)
    const transactions = await TransactionModel.find({
      isRecurring: true,
      nextRecurringDate: { $lte: now }
    }).select('_id')

    if (!transactions.length) {
      logger.info('✅ No recurring transactions to process')
      return
    }

    const todayStr = now.toISOString().split('T')[0]

    // 2. Chọc vào Redis/BullMQ (Có thể rủi ro lỗi kết nối Redis)
    await transactionQueue.addBulk(
      transactions.map((tx) => ({
        name: TRANSACTION_JOBS.RECURRING,
        data: { transactionId: tx._id.toString() },
        opts: {
          jobId: `recurring-${tx._id.toString()}-${todayStr}`
        }
      }))
    )

    logger.info(`📥 Enqueued ${transactions.length} recurring transactions`)
  } catch (error: any) {
    // 3. Gom hết rủi ro vào đây để Server không bao giờ bị Crash
    logger.error('❌ Failed to enqueue recurring transactions', {
      error: error?.message,
      stack: error?.stack
    })
  }
}
