import { Queue } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { BulkTransactionItem } from '../services/transaction.service'

// ─── Job Names ────────────────────────────────────────────────────────────────

export const TRANSACTION_JOBS = {
  RECURRING: 'process-recurring-transaction',
  BULK_IMPORT: 'bulk-import'
} as const

// ─── Job Data Types ───────────────────────────────────────────────────────────

export type RecurringJobData = {
  transactionId: string
}

export type BulkImportJobData = {
  userId: string
  transactions: BulkTransactionItem[]
}

// ─── Queue ────────────────────────────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
}

export const transactionQueue = new Queue<RecurringJobData | BulkImportJobData>(
  'TRANSACTION_QUEUE',
  {
    connection: bullMQConnection,
    defaultJobOptions
  }
)
