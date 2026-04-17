import { Queue } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'

// Tên các loại việc
export const TRANSACTION_JOBS = {
  RECURRING: 'process-recurring-transaction'
} as const

// Data bắt buộc phải có khi giao việc
export type RecurringJobData = {
  transactionId: string
}

// Khởi tạo Queue
export const transactionQueue = new Queue<RecurringJobData>(
  'TRANSACTION_QUEUE',
  {
    connection: bullMQConnection,
    defaultJobOptions: {
      attempts: 3, // Thử lại 3 lần nếu DB bị lỗi (deadlock, timeout)
      backoff: { type: 'exponential', delay: 5000 }, // Lần 1 chờ 5s, lần 2 chờ 10s...
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    }
  }
)
