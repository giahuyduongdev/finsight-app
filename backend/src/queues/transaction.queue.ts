import { Queue } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { BulkTransactionItem } from '../services/transaction.service'

// ─── Job Names ────────────────────────────────────────────────────────────────

export const TRANSACTION_JOBS = {
  RECURRING: 'process-recurring-transaction',
  RECURRING_SUMMARY: 'recurring-summary',
  BULK_IMPORT: 'bulk-import'
} as const

// ─── Job Data Types ───────────────────────────────────────────────────────────

export type RecurringJobData = {
  userId: string
  transactionIds?: string[] // Danh sách ID để xử lý hàng loạt trong 1 Job con
}

export type BulkImportJobData = {
  userId: string
  importBatchId: string
}

// ─── Queue ────────────────────────────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: {
    count: 100,
    age: 24 * 3600 // xóa sau 24 giờ dù chưa đủ 100
  },
  removeOnFail: {
    count: 50,
    age: 7 * 24 * 3600 // giữ failed jobs 7 ngày để debug
  }
}

export const transactionQueue = new Queue<RecurringJobData | BulkImportJobData>(
  'TRANSACTION_QUEUE',
  {
    connection: bullMQConnection,
    streams: {
      events: {
        maxLen: 100 // chỉ giữ 100 events gần nhất
      }
    },
    defaultJobOptions
  }
)
