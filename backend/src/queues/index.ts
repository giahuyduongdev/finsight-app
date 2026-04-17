import { logger } from '../config/logger.config'
import { bullMQConnection } from '../config/bull/bullmq.config'

import { transactionQueue } from './transaction.queue'
// import { reportQueue } from './report.queue'

const queues = [
  transactionQueue
  // reportQueue,
]

export const closeQueues = async () => {
  logger.info('🛑 [BullMQ] Closing the queues...')

  // 1. Đóng toàn bộ các Queue song song
  await Promise.all(queues.map((q) => q.close()))

  // 2. CHỐT CHẶN CUỐI CÙNG: Ngắt kết nối Redis của toàn bộ hệ thống BullMQ
  await bullMQConnection.quit()

  logger.info(
    '✅ [BullMQ] The Redis queue and connection have been safely terminated.'
  )
}

export { transactionQueue }
