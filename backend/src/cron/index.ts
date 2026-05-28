import { startJobs } from './scheduler'

export const initializeCrons = async () => {
  try {
    const jobs = startJobs()
    console.log(`⏰ ${jobs.length} cron jobs intialized`)
    return jobs
  } catch (error) {
    console.error('CRON INIT ERROR:', error)
    return []
  }
}
