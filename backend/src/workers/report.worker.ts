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
import ReportModel, {
  ReportDocument,
  ReportStatusEnum
} from '../models/report.model'
import ReportSettingModel from '../models/report-setting.model'
import UserModel from '../models/user.model'
import { sendReportEmail } from '../mailers/report.mailer'
import { calculateNextReportDate } from '../utils/dates/index'
import { emitReportListUpdated } from '../utils/report-socket.util'
import { buildReportDeliveryKey } from '../utils/report-delivery.util'
import {
  getJobAttemptContext,
  JobOutcome
} from '../utils/bullmq/job-reliability.util'

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
export const processReportJob = async (
  job: Job<ProcessReportJobData>
): Promise<JobOutcome> => {
  const { userId, settingId, timezone, preferredCurrency, frequency, dueDate } =
    job.data
  const now = new Date()
  const scheduledDate = new Date(dueDate)
  const deliveryKey = buildReportDeliveryKey(settingId, scheduledDate)

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

  const fallbackPeriod = `${formatInTimeZone(from, timezone, 'MMMM d')}–${formatInTimeZone(to, timezone, 'd, yyyy')}`

  const delivery = await ReportModel.findOneAndUpdate(
    { deliveryKey },
    {
      $setOnInsert: {
        userId,
        settingId,
        dueDate: scheduledDate,
        deliveryKey,
        sentDate: now,
        period: fallbackPeriod,
        status: ReportStatusEnum.PENDING,
        attemptCount: 0,
        createdAt: now,
        updatedAt: now
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  if (
    delivery.status === ReportStatusEnum.SENT ||
    delivery.status === ReportStatusEnum.NO_ACTIVITY
  ) {
    return {
      status: 'skipped',
      reason: 'delivery-already-terminal',
      details: { deliveryKey, reportId: delivery._id.toString() }
    }
  }

  // 1. Generate báo cáo only after the delivery replay guard.
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

  const period = report?.period || fallbackPeriod

  // 2. Gửi email
  let emailSent = false
  let providerMessageId: string | undefined
  if (report && email) {
    try {
      const emailResponse = await sendReportEmail({
        email,
        username,
        idempotencyKey: deliveryKey,
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
      providerMessageId = emailResponse.data?.id
      emailSent = true
      logger.info('[JOB:Report] Email sent successfully', { userId })
    } catch (error) {
      logger.error('[JOB:Report] Email failed', {
        userId,
        error: (error as Error).message,
        attemptsMade: job.attemptsMade,
        attemptsStarted: job.attemptsStarted
      })

      await ReportModel.updateOne(
        { _id: delivery._id },
        {
          $inc: { attemptCount: 1 },
          $set: {
            lastError:
              error instanceof Error ? error.message : 'Unknown email error',
            updatedAt: new Date()
          }
        }
      )

      throw error
    }
  }

  // 3. Lưu lịch sử + cập nhật nextReportDate trong transaction
  const session = await mongoose.startSession()
  let persistedReport: ReportDocument | undefined

  try {
    await session.withTransaction(
      async () => {
        const status =
          report && emailSent
            ? ReportStatusEnum.SENT
            : ReportStatusEnum.NO_ACTIVITY

        await ReportModel.updateOne(
          { _id: delivery._id },
          {
            $set: {
              status,
              period,
              ...(providerMessageId ? { providerMessageId } : {}),
              lastError: null,
              updatedAt: now
            }
          },
          { session }
        )

        delivery.status = status
        delivery.period = period
        persistedReport = delivery

        // Cập nhật ngày gửi tiếp theo
        await ReportSettingModel.updateOne(
          { _id: settingId },
          {
            $set: {
              ...(status === ReportStatusEnum.SENT
                ? { lastSentDate: now }
                : {}),
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

  if (persistedReport) {
    emitReportListUpdated({
      userId,
      reason: 'generated',
      reportId: persistedReport._id?.toString(),
      status: persistedReport.status as ReportStatusEnum,
      period: persistedReport.period,
      source: 'worker'
    })
  }

  return {
    status: 'succeeded',
    details: { userId, deliveryKey, reportId: persistedReport?._id.toString() }
  }
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
  const attemptContext = job
    ? getJobAttemptContext(job)
    : { attemptsMade: 0, maxAttempts: 1, isFinalAttempt: true }
  const { attemptsMade, maxAttempts, isFinalAttempt } = attemptContext
  const isRetrying = !isFinalAttempt

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

  if (job) {
    const deliveryKey = buildReportDeliveryKey(
      job.data.settingId,
      job.data.dueDate
    )
    void ReportModel.updateOne(
      { deliveryKey },
      {
        $set: {
          status: ReportStatusEnum.FAILED,
          lastError: err.message,
          updatedAt: new Date()
        }
      }
    )
      .then(() => {
        emitReportListUpdated({
          userId: job.data.userId,
          reason: 'generated',
          status: ReportStatusEnum.FAILED,
          source: 'worker'
        })
      })
      .catch((updateError) => {
        logger.error('[JOB:Report] Failed to persist terminal delivery state', {
          deliveryKey,
          error:
            updateError instanceof Error
              ? updateError.message
              : String(updateError)
        })
      })
  }

  logger.error(`[JOB:Report] Report failed: ${job?.id}`, logMetadata)
})

reportWorker.on('error', (error) => {
  logger.error('[SYS:BullMQ] Report worker infrastructure error', {
    queueName: 'REPORT_QUEUE',
    eventType: 'error',
    error: error.message,
    stack: error.stack
  })
})
