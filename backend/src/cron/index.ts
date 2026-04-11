import { logger } from '../config/logger.config'
import { startJobs } from './scheduler'
import { ScheduledTask } from 'node-cron'

let jobs: ScheduledTask[] = []

export const initializeCrons = async () => {
  try {
    jobs = startJobs()
    logger.info(`⏰ ${jobs.length} Cron jobs initialized`)
  } catch (error) {
    logger.error('CRON INIT ERROR:', error)
  }
}

export const stopCrons = () => {
  jobs.forEach((job) => job.stop())
  jobs = []
  logger.info('✅ Cron jobs stopped')
}
