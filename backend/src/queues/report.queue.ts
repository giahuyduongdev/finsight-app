import { Queue } from 'bullmq'
import { bullMQConnection } from '../config/bull/bullmq.config'

// ─── Job Names ────────────────────────────────────────────────────────────────

export const REPORT_JOBS = {
  PROCESS_REPORT: 'process-report'
} as const

// ─── Job Data Types ───────────────────────────────────────────────────────────

export type ProcessReportJobData = {
  userId: string
  settingId: string
  timezone: string
  preferredCurrency?: string
  email: string
  username: string
  frequency: string
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

export const reportQueue = new Queue<ProcessReportJobData>('REPORT_QUEUE', {
  connection: bullMQConnection,
  streams: {
    events: {
      maxLen: 100 // chỉ giữ 100 events gần nhất
    }
  },
  defaultJobOptions
})
