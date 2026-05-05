import { FlowProducer } from 'bullmq'
import { logger } from '../config/logger.config'
import { bullMQConnection } from '../config/bull/bullmq.config'

import { transactionQueue } from './transaction.queue'
import { receiptQueue } from './receipt.queue'
import { reportQueue } from './report.queue'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

const queues = [transactionQueue, receiptQueue, reportQueue]

export const closeQueues = async () => {
  logger.info(logIcon(LOG_ICONS.STOP, '[BullMQ] Closing the queues...'))

  try {
    // 1. Đóng toàn bộ các Queue song song
    await Promise.all(queues.map((q) => q.close()))

    // 2. Đóng FlowProducer
    await transactionFlowProducer.close()
  } finally {
    // 3. CHỐT CHẶN CUỐI CÙNG: Ngắt kết nối Redis của toàn bộ hệ thống BullMQ
    // Ensure this runs even if queue/producer close fails
    await bullMQConnection.quit()
  }

  logger.info(
    logIcon(
      LOG_ICONS.SUCCESS,
      '[BullMQ] The Redis queue and connection have been safely terminated.'
    )
  )
}

export const transactionFlowProducer = new FlowProducer({
  connection: bullMQConnection
})

export { transactionQueue, receiptQueue }
export * from './transaction.queue'
export * from './receipt.queue'
export * from './report.queue'
