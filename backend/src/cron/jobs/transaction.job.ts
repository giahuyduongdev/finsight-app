import TransactionModel from '../../models/transaction.model'
import {
  transactionQueue,
  transactionFlowProducer, // Thêm FlowProducer
  TRANSACTION_JOBS
} from '../../queues'
import { logger } from '../../config/logger.config'

export const processRecurringTransactions = async () => {
  const now = new Date()
  logger.info('🚀  Enqueuing recurring transactions flows...')

  try {
    // 1. Lấy tất cả giao dịch đến hạn
    const transactions = await TransactionModel.find({
      isRecurring: true,
      nextRecurringDate: { $lte: now }
    }).select('_id userId')

    logger.info(
      `🔍 Found ${transactions.length} due transactions across all users`
    )

    // 2. Nhóm theo UserId để tạo Flow cho từng người
    const userGroups: Record<string, any[]> = {}
    transactions.forEach((tx) => {
      const uId = tx.userId.toString()
      if (!userGroups[uId]) userGroups[uId] = []
      userGroups[uId].push(tx)
    })

    Object.entries(userGroups).forEach(([uId, txs]) => {
      logger.info(`👥 User ${uId}: ${txs.length} transactions due`)
    })

    const timeId = now.getTime()

    // 3. Tạo Flow cho mỗi User
    const CHUNK_SIZE = 200 // Mỗi Job con sẽ xử lý tối đa 200 giao dịch

    for (const userId in userGroups) {
      const userTxs = userGroups[userId]

      // Chia nhỏ danh sách giao dịch của user này thành từng mẻ
      const batches = []
      for (let i = 0; i < userTxs.length; i += CHUNK_SIZE) {
        batches.push(userTxs.slice(i, i + CHUNK_SIZE))
      }

      await transactionFlowProducer.add({
        name: TRANSACTION_JOBS.RECURRING_SUMMARY, // Job CHA (Chốt hạ)
        queueName: 'TRANSACTION_QUEUE',
        data: { userId, count: userTxs.length },
        opts: {
          jobId: `recurring-summary-${userId}-${timeId}`
        },
        children: batches.map((batch, index) => ({
          name: TRANSACTION_JOBS.RECURRING, // Job CON (Xử lý mẻ)
          queueName: 'TRANSACTION_QUEUE',
          data: {
            transactionIds: batch.map((tx) => tx._id.toString()),
            userId: userId
          },
          opts: {
            // Đảm bảo jobId không trùng lặp cho từng mẻ
            jobId: `recurring-batch-${userId}-${index}-${timeId}`
          }
        }))
      })
    }

    logger.info(
      `📥 Enqueued recurring flows for ${Object.keys(userGroups).length} users (${transactions.length} txs, grouped in ${CHUNK_SIZE} per child)`
    )
  } catch (error: any) {
    // 3. Gom hết rủi ro vào đây để Server không bao giờ bị Crash
    logger.error('❌ Failed to enqueue recurring transactions', {
      error: error?.message,
      stack: error?.stack
    })
  }
}
