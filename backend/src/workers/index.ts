import { logger } from '../config/logger.config'

// 1. Import tất cả các Worker đang có
import { transactionWorker } from './transaction.worker'

// 2. Đưa vào mảng quản lý tập trung
const workers = [
  transactionWorker
  // reportWorker,
  // receiptWorker,
]

// 3. Hàm khởi động (Chủ yếu để ghi log vì worker tự động chạy khi được import)
export const initializeWorkers = () => {
  logger.info(
    `⚙️  [BullMQ] The workers have started up: ${workers.length} successfully. Waiting for work...`
  )
  return workers
}

// 4. Hàm Graceful Shutdown (Đóng đồng loạt tất cả các Worker)
export const stopWorkers = async () => {
  logger.info('🛑 [BullMQ] We are asking workers to stop accepting new jobs...')

  // Chạy song song lệnh close() cho tất cả worker, giúp tắt server siêu tốc
  await Promise.all(workers.map((w) => w.close()))

  logger.info('✅ [BullMQ] All workers stopped safely.')
}
