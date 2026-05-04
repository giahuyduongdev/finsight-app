import { logger } from '../config/logger.config'
import { startJobs } from './scheduler'
import { ScheduledTask } from 'node-cron'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

let jobs: ScheduledTask[] = []

export const initializeCrons = async () => {
  try {
    jobs = startJobs()
    logger.info(
      logIcon(LOG_ICONS.SCHEDULE, ` ${jobs.length} Cron jobs initialized`)
    )
  } catch (error) {
    logger.error(logIcon(LOG_ICONS.ERROR, 'CRON INIT ERROR:'), error)
  }
}

export const stopCrons = () => {
  jobs.forEach((job) => job.stop())
  jobs = []
  logger.info(logIcon(LOG_ICONS.SUCCESS, 'Cron jobs stopped'))
}
