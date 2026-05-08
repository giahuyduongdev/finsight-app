import { UserDocument } from '../../models/user.model'
import { reportQueue, REPORT_JOBS } from '../../queues/report.queue'
import { logger } from '../../config/logger.config'
import { container } from '../../container'

export const processReportJob = async () => {
  const now = new Date()

  logger.info('[JOB:Cron] Fetching report settings due for processing...')

  try {
    // Get ReportSettingRepository from DI container
    const reportSettingRepository = container.getReportSettingRepository()

    const settings = await reportSettingRepository.findEnabledDue(now)

    if (!settings.length) {
      logger.info('[JOB:Cron] No reports due at this time')
      return
    }

    logger.info(`[JOB:Cron] Found ${settings.length} report(s) to enqueue`)

    const jobs = settings
      .filter((setting) => {
        const user = setting.userId as unknown as UserDocument
        if (!user || !user.id) {
          logger.warn(`[JOB:Cron] User not found for setting: ${setting._id}`)
          return false
        }
        return true
      })
      .map((setting) => {
        const user = setting.userId as unknown as UserDocument
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
      `[JOB:Cron] Enqueued ${jobs.length} report job(s) into REPORT_QUEUE`
    )
  } catch (error) {
    logger.error('[JOB:Cron] Failed to enqueue report jobs', {
      error: (error as Error).message
    })
  }
}
