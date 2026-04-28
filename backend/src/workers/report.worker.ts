import { Worker, Job } from 'bullmq'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import mongoose from 'mongoose'
import { bullMQConnection } from '../config/bull/bullmq.config'
import { logger } from '../config/logger.config'
import { REPORT_JOBS, ProcessReportJobData } from '../queues/report.queue'
import { generateReportService } from '../services/report.service'
import ReportModel, { ReportStatusEnum } from '../models/report.model'
import ReportSettingModel from '../models/report-setting.model'
import { sendReportEmail } from '../mailers/report.mailer'
import { calculateNextReportDate } from '../utils/dates/index'

// ─── Job Processing ───────────────────────────────────────────────────────────

/**
 * Xử lý tạo và gửi báo cáo cho 1 user
 */
const processReportJob = async (job: Job<ProcessReportJobData>) => {
  const {
    userId,
    settingId,
    timezone,
    preferredCurrency,
    email,
    username,
    frequency
  } = job.data
  const now = new Date()

  // Tính khoảng thời gian tháng trước theo timezone của user
  const nowInUserTz = toZonedTime(now, timezone)
  const from = fromZonedTime(startOfMonth(subMonths(nowInUserTz, 1)), timezone)
  const to = fromZonedTime(endOfMonth(subMonths(nowInUserTz, 1)), timezone)

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
                `${format(from, 'MMMM d')}–${format(to, 'd, yyyy')}`,
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
              lastSentDate: isSuccess ? now : null,
              nextReportDate: calculateNextReportDate(now),
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
    } else {
      logger.warn(`❓ [Worker] Unknown job name: ${job.name}`)
    }
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
