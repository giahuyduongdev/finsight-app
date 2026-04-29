import { Worker, Job } from 'bullmq'
import { endOfMonth, startOfMonth, subMonths } from 'date-fns'
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

  const email = user.email!
  const username = user.name || email.split('@')[0]

  // Tính khoảng thời gian tháng trước theo timezone của user dựa trên ngày đến hạn (dueDate)
  const dueInUserTz = toZonedTime(scheduledDate, timezone)
  const from = fromZonedTime(startOfMonth(subMonths(dueInUserTz, 1)), timezone)
  const to = fromZonedTime(endOfMonth(subMonths(dueInUserTz, 1)), timezone)

  // 1. Generate report
  const report = await generateReportService(
    userId,
    from,
    to,
    timezone,
    preferredCurrency
  )

  logger.debug('[Worker] Report data generated', {
    userId,
    period: report?.period
  })

  // 2. Gửi email (không throw để tránh retry toàn bộ job chỉ vì email lỗi)
  let emailSent = false
  if (report) {
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
      logger.info('📧 [Worker] Email sent successfully', { userId })
    } catch (error) {
      logger.error('❌ [Worker] Email failed', {
        userId,
        error: (error as Error).message
      })
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
              nextReportDate: calculateNextReportDate(scheduledDate),
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
    logger.error('❌ [Worker] Unknown job name', {
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
    `✅ [Worker] Report completed: ${job.id} for user ${job.data.userId}`
  )
})

reportWorker.on('failed', (job, err) => {
  logger.error(`❌ [Worker] Report failed: ${job?.id}`, {
    error: err.message,
    userId: job?.data.userId,
    attemptsMade: job?.attemptsMade,
    maxAttempts: job?.opts.attempts
  })
})
