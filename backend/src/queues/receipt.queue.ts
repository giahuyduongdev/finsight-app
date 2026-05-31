import { Queue } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'

// ─── Job Names ────────────────────────────────────────────────────────────────

export const RECEIPT_JOBS = {
  SCAN_RECEIPT: 'scan-receipt'
} as const

// ─── Job Data Types ───────────────────────────────────────────────────────────

export type ScanReceiptJobData = {
  userId: string
  fileName: string
  fileSize: number
  imageHash?: string
  correlationId?: string
} & (
  | {
      fileBuffer: string // Legacy path: compressed base64 image still present in older queued jobs
      imageUrl?: string
    }
  | {
      imageUrl: string // Preferred path: Cloudinary URL keeps Redis/BullMQ payload small
      fileBuffer?: string
    }
)

// ─── Queue ────────────────────────────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: {
    count: 100,
    age: 24 * 3600 // remove after 24 hours even if not 100 jobs
  },
  removeOnFail: {
    count: 50,
    age: 7 * 24 * 3600 // keep failed jobs for 7 days for debugging
  }
}

export const receiptQueue = new Queue<ScanReceiptJobData>('RECEIPT_QUEUE', {
  connection: bullMQConnection,
  streams: {
    events: {
      maxLen: 100 // keep only last 100 events
    }
  },
  defaultJobOptions
})
