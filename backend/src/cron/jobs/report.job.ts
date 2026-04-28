import ReportSettingModel from '../../models/report-setting.model'
import { UserDocument } from '../../models/user.model'
import { reportQueue, REPORT_JOBS } from '../../queues/report.queue'
import { logger } from '../../config/logger.config'

export const processReportJob = async () => {
  const now = new Date()

  logger.info('🔄 [Cron] Fetching report settings due for processing...')

  try {
    const settings = await ReportSettingModel.find({
      isEnabled: true,
      nextReportDate: { $lte: now }
    }).populate<{ userId: UserDocument }>('userId')

    if (!settings.length) {
      logger.info('📭 [Cron] No reports due at this time')
      return
    }

    logger.info(`📋 [Cron] Found ${settings.length} report(s) to enqueue`)

    const jobs = settings
      .filter((setting) => {
        const user = setting.userId as UserDocument
        if (!user) {
          logger.warn(`⚠️ [Cron] User not found for setting: ${setting._id}`)
          return false
        }
        return true
      })
      .map((setting) => {
        const user = setting.userId as UserDocument
        return {
          name: REPORT_JOBS.PROCESS_REPORT,
          data: {
            userId: user.id as string,
            settingId: setting._id.toString(),
            timezone: user.timezone || 'UTC',
            preferredCurrency: user.preferredCurrency,
            email: user.email!,
            username: user.name!,
            frequency: setting.frequency!
          },
          opts: {
            // jobId duy nhất để tránh enqueue trùng nếu cron chạy lại
            jobId: `process-report-${user.id}-${now.getTime()}`
          }
        }
      })

    await reportQueue.addBulk(jobs)

    logger.info(
      `📥 [Cron] Enqueued ${jobs.length} report job(s) into REPORT_QUEUE`
    )
  } catch (error) {
    logger.error('❌ [Cron] Failed to enqueue report jobs', {
      error: (error as Error).message
    })
  }
}
