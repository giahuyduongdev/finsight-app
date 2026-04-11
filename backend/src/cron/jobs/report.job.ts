import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import ReportSettingModel from '../../models/report-setting.model'
import { UserDocument } from '../../models/user.model'
import mongoose from 'mongoose'
import { generateReportService } from '../../services/report.service'
import ReportModel, { ReportStatusEnum } from '../../models/report.model'
import { calculateNextReportDate } from '../../utils/dates/index'
import { sendReportEmail } from '../../mailers/report.mailer'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { logger } from '../../config/logger.config'

export const processReportJob = async () => {
  const now = new Date()

  let processedCount = 0
  let failedCount = 0

  try {
    const reportSettingCursor = ReportSettingModel.find({
      isEnabled: true,
      nextReportDate: { $lte: now }
    })
      .populate<{ userId: UserDocument }>('userId')
      .cursor()

    logger.info('🔄 Starting report job...')

    for await (const setting of reportSettingCursor) {
      const user = setting.userId as UserDocument
      if (!user) {
        logger.warn(`User not found for setting: ${setting._id}`)
        continue
      }

      const timezone = user.timezone || 'UTC'
      const nowInUserTz = toZonedTime(now, timezone)
      const from = startOfMonth(subMonths(nowInUserTz, 1))
      const to = endOfMonth(subMonths(nowInUserTz, 1))
      const fromUTC = fromZonedTime(from, timezone)
      const toUTC = fromZonedTime(to, timezone)

      const session = await mongoose.startSession()

      try {
        const report = await generateReportService(
          user.id,
          fromUTC,
          toUTC,
          timezone,
          user.preferredCurrency
        )

        logger.debug('Report data generated', {
          userId: user.id,
          period: report?.period
        })

        let emailSent = false
        if (report) {
          try {
            await sendReportEmail({
              email: user.email!,
              username: user.name!,
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
              frequency: setting.frequency!
            })
            emailSent = true
            logger.info('📧 Email sent successfully', { userId: user.id })
          } catch (error) {
            logger.error('Email failed', {
              userId: user.id,
              error: (error as Error).message
            })
          }
        }

        await session.withTransaction(
          async () => {
            const bulkReports: any[] = []
            const bulkSettings: any[] = []

            if (report && emailSent) {
              bulkReports.push({
                insertOne: {
                  document: {
                    userId: user.id,
                    sentDate: now,
                    period: report.period,
                    status: ReportStatusEnum.SENT,
                    createdAt: now,
                    updatedAt: now
                  }
                }
              })

              bulkSettings.push({
                updateOne: {
                  filter: { _id: setting._id },
                  update: {
                    $set: {
                      lastSentDate: now,
                      nextReportDate: calculateNextReportDate(now),
                      updatedAt: now
                    }
                  }
                }
              })
            } else {
              bulkReports.push({
                insertOne: {
                  document: {
                    userId: user.id,
                    sentDate: now,
                    period:
                      report?.period ||
                      `${format(from, 'MMMM d')}–${format(to, 'd, yyyy')}`,
                    status: report
                      ? ReportStatusEnum.FAILED
                      : ReportStatusEnum.NO_ACTIVITY,
                    createdAt: now,
                    updatedAt: now
                  }
                }
              })

              bulkSettings.push({
                updateOne: {
                  filter: { _id: setting._id },
                  update: {
                    $set: {
                      lastSentDate: null,
                      nextReportDate: calculateNextReportDate(now),
                      updatedAt: now
                    }
                  }
                }
              })
            }

            await Promise.all([
              ReportModel.bulkWrite(bulkReports, { ordered: false }),
              ReportSettingModel.bulkWrite(bulkSettings, { ordered: false })
            ])
          },
          { maxCommitTimeMS: 10000 }
        )

        processedCount++
      } catch (error) {
        logger.error('Failed to process report', {
          userId: user.id,
          error: (error as Error).message
        })
        failedCount++
      } finally {
        await session.endSession()
      }
    }

    logger.info(`✅ Processed: ${processedCount} reports`)
    if (failedCount > 0) {
      logger.warn(`❌ Failed: ${failedCount} reports`)
    }

    return { success: true, processedCount, failedCount }
  } catch (error) {
    logger.error('Error processing reports', {
      error: (error as Error).message
    })
    return { success: false, error: 'Report process failed' }
  }
}
