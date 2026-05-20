import { Worker, Job } from 'bullmq'
import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import mongoose from 'mongoose'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import { REPORT_JOBS, ProcessReportJobData } from '../queues/report.queue'
import { generateReportService } from '../services/report.service'
import ReportModel, { ReportStatusEnum } from '../models/report.model'
import ReportSettingModel from '../models/report-setting.model'
import UserModel from '../models/user.model'
import { sendReportEmail } from '../mailers/report.mailer'
import { calculateNextReportDate } from '../utils/dates/index'

const MAX_RETRY_DELAY_MS = 30000

function getNextRetryDelay(job?: Job): number {
  const backoff = job?.opts.backoff
  const baseDelay =
    typeof backoff === 'object' &&
    backoff !== null &&
    'delay' in backoff &&
    typeof backoff.delay === 'number'
      ? backoff.delay
      : 1000
  const retryIndex = Math.max((job?.attemptsMade ?? 1) - 1, 0)

  return Math.min(baseDelay * 2 ** retryIndex, MAX_RETRY_DELAY_MS)
}

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Xử lý tạo và gửi báo cáo cho 1 user
 */
const processReportJob = async (job: Job<ProcessReportJobData>) => {
  const { userId, settingId, timezone, preferredCurrency, frequency, dueDate } =
    job.data
  const now = new Date()
  const scheduledDate = new Date(dueDate)

  // 0. Fetch user for PII (email/username)
  const user = await UserModel.findById(userId).lean()
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const email = user.email
  const username = user.name || (email ? email.split('@')[0] : 'User')

  // Validate email before proceeding
  if (!email) {
    logger.error('[JOB:Report] User email not found', { userId })
    throw new Error(`User email not found for userId: ${userId}`)
  }

  // Tính khoảng thời gian báo cáo theo timezone của user dựa trên ngày đến hạn (dueDate)
  const dueInUserTz = toZonedTime(scheduledDate, timezone)

  let fromInTz: Date
  let toInTz: Date

  switch (frequency) {
    case 'DAILY':
      fromInTz = startOfDay(subDays(dueInUserTz, 1))
      toInTz = endOfDay(subDays(dueInUserTz, 1))
      break
    case 'WEEKLY':
      fromInTz = startOfWeek(subWeeks(dueInUserTz, 1), { weekStartsOn: 1 })
      toInTz = endOfWeek(subWeeks(dueInUserTz, 1), { weekStartsOn: 1 })
      break
    case 'QUARTERLY':
      fromInTz = startOfQuarter(subQuarters(dueInUserTz, 1))
      toInTz = endOfQuarter(subQuarters(dueInUserTz, 1))
      break
    case 'ANNUALLY':
      fromInTz = startOfYear(subYears(dueInUserTz, 1))
      toInTz = endOfYear(subYears(dueInUserTz, 1))
      break
    case 'MONTHLY':
    default:
      fromInTz = startOfMonth(subMonths(dueInUserTz, 1))
      toInTz = endOfMonth(subMonths(dueInUserTz, 1))
      break
  }

  const from = fromZonedTime(fromInTz, timezone)
  const to = fromZonedTime(toInTz, timezone)

  // 1. Generate báo cáo
  const report = await generateReportService(
    userId,
    from,
    to,
    timezone,
    preferredCurrency
  )

  logger.debug('[JOB:Report] Report data generated', {
    userId,
    period: report?.period
  })

  // 2. Gửi email
  let emailSent = false
  if (report && email) {
    try {
      await sendReportEmail({
        email,
        username,
        report: {
          period: report.period,
          totalIncome: report.summary.income,
          totalExpenses: report.summary.expenses,
          availableBalance: report.summary.balance,
          savingsRate: report.summary.savingsRate,
          topSpendingCategories: report.summary.topCategories,
          insights: report.insights,
          currency: report.currency || 'USD'
        },
        frequency
      })
      emailSent = true
      logger.info('[JOB:Report] Email sent successfully', { userId })
    } catch (error) {
      logger.error('[JOB:Report] Email failed', {
        userId,
        error: (error as Error).message,
        attemptsMade: job.attemptsMade,
        attemptsStarted: job.attemptsStarted
      })

      // Persist FAILED report before throwing (for audit trail)
      const session = await mongoose.startSession()
      try {
        await session.withTransaction(
          async () => {
            await ReportModel.create(
              [
                {
                  userId,
                  sentDate: now,
                  period:
                    report?.period ||
                    `${formatInTimeZone(from, timezone, 'MMMM d')}–${formatInTimeZone(to, timezone, 'd, yyyy')}`,
                  status: ReportStatusEnum.FAILED,
                  createdAt: now,
                  updatedAt: now
                }
              ],
              { session }
            )
          },
          { maxCommitTimeMS: 10000 }
        )
      } finally {
        await session.endSession()
      }

      // Always throw to mark job as failed
      throw error
    }
  }

  // 3. Lưu lịch sử + cập nhật nextReportDate trong transaction
  const session = await mongoose.startSession()

  try {
    await session.withTransaction(
      async () => {
        const isSuccess = report && emailSent

        // Lưu lịch sử Report
        await ReportModel.create(
          [
            {
              userId,
              sentDate: now,
              period:
                report?.period ||
                `${formatInTimeZone(from, timezone, 'MMMM d')}–${formatInTimeZone(to, timezone, 'd, yyyy')}`,
              status: isSuccess
                ? ReportStatusEnum.SENT
                : report
                  ? ReportStatusEnum.FAILED
                  : ReportStatusEnum.NO_ACTIVITY,
              createdAt: now,
              updatedAt: now
            }
          ],
          { session }
        )

        // Cập nhật ngày gửi tiếp theo
        await ReportSettingModel.updateOne(
          { _id: settingId },
          {
            $set: {
              ...(isSuccess ? { lastSentDate: now } : {}),
              nextReportDate: calculateNextReportDate(scheduledDate, frequency),
              updatedAt: now
            }
          },
          { session }
        )
      },
      { maxCommitTimeMS: 10000 }
    )
  } finally {
    await session.endSession()
  }

  return { success: true, userId }
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export const reportWorker = new Worker(
  'REPORT_QUEUE',
  async (job) => {
    if (job.name === REPORT_JOBS.PROCESS_REPORT) {
      return await processReportJob(job as Job<ProcessReportJobData>)
    }
    logger.error('[JOB:Report] Unknown job name', {
      jobId: job.id,
      jobName: job.name
    })
    throw new Error(`Unknown report job name: ${job.name}`)
  },
  {
    connection: bullMQConnection,
    concurrency: 3 // Report gọi Gemini AI nên giữ thấp, tương tự receipt worker
  }
)

// ─── Events ───────────────────────────────────────────────────────────────────

reportWorker.on('completed', (job) => {
  logger.info(
    `[JOB:Report] Report completed: ${job.id} for user ${job.data.userId}`
  )
})

reportWorker.on('failed', (job, err) => {
  const attemptsMade = job?.attemptsMade ?? 0
  const maxAttempts = job?.opts?.attempts ?? 1
  const isRetrying = attemptsMade < maxAttempts

  const logMetadata = {
    error: err.message,
    userId: job?.data.userId,
    correlationId: job?.data.correlationId,
    attemptsMade,
    maxAttempts,
    ...(isRetrying && { nextRetryDelayMs: getNextRetryDelay(job) })
  }

  if (isRetrying) {
    logger.warn(`[JOB:Report] Report retry scheduled: ${job?.id}`, logMetadata)
    return
  }

  logger.error(`[JOB:Report] Report failed: ${job?.id}`, logMetadata)
})
