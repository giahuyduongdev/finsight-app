import ReportSettingModel from '../../models/report-setting.model'
import { UserDocument } from '../../models/user.model'
import { reportQueue, REPORT_JOBS } from '../../queues/report.queue'
import { logger } from '../../config/logger.config'
import { logIcon, LOG_ICONS } from '../../utils/logger-icon.util'

export const processReportJob = async () => {
  const now = new Date()

  logger.info(
    logIcon(
      LOG_ICONS.QUEUE,
      '[Cron] Fetching report settings due for processing...'
    )
  )

  try {
    const settings = await ReportSettingModel.find({
      isEnabled: true,
      nextReportDate: { $lte: now }
    }).populate<{ userId: UserDocument }>('userId')

    if (!settings.length) {
      logger.info(logIcon(LOG_ICONS.INFO, '[Cron] No reports due at this time'))
      return
    }

    logger.info(
      logIcon(
        LOG_ICONS.QUEUE,
        `[Cron] Found ${settings.length} report(s) to enqueue`
      )
    )

    const jobs = settings
      .filter((setting) => {
        const user = setting.userId as UserDocument
        if (!user) {
          logger.warn(
            logIcon(
              LOG_ICONS.WARNING,
              `[Cron] User not found for setting: ${setting._id}`
            )
          )
          return false
        }
        return true
      })
      .map((setting) => {
        const user = setting.userId as UserDocument
        // Validate frequency before using
        const frequency = setting.frequency || 'MONTHLY'
        return {
          name: REPORT_JOBS.PROCESS_REPORT,
          data: {
            userId: user.id as string,
            settingId: setting._id.toString(),
            timezone: user.timezone || 'UTC',
            preferredCurrency: user.preferredCurrency,
            frequency,
            dueDate: setting.nextReportDate?.toISOString() || now.toISOString()
          },
          opts: {
            // jobId duy nhất để tránh enqueue trùng nếu cron chạy lại
            jobId: `process-report-${setting._id}-${setting.nextReportDate?.toISOString() || now.toISOString()}`
          }
        }
      })

    await reportQueue.addBulk(jobs)

    logger.info(
      logIcon(
        LOG_ICONS.QUEUE,
        `[Cron] Enqueued ${jobs.length} report job(s) into REPORT_QUEUE`
      )
    )
  } catch (error) {
    logger.error(
      logIcon(LOG_ICONS.ERROR, '[Cron] Failed to enqueue report jobs'),
      {
        error: (error as Error).message
      }
    )
  }
}
