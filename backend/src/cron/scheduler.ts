import cron from 'node-cron'
import { processRecurringTransactions } from './jobs/transaction.job'
import { processReportJob } from './jobs/report.job'
import RefreshTokenModel from '../models/refresh-token.model'

const scheduleJob = (name: string, time: string, job: Function) => {
  console.log(`Scheduling ${name} at ${time}`)

  return cron.schedule(
    time,
    async () => {
      try {
        await job()
        console.log(`${name} completed`)
      } catch (error) {
        console.log(`${name} failed`, error)
      }
    },
    {
      scheduled: true,
      timezone: 'UTC'
    }
  )
}

export const startJobs = () => {
  return [
    // scheduleJob('Transaction', '* * * * *', processRecurringTransactions),

    //Run 2:30am every first of the month
    // scheduleJob('Reports', '30 2 1 * *', processReportJob),

    // Chạy 00:00 mỗi ngày
    scheduleJob('Cleanup Tokens', '0 0 * * *', async () => {
      await RefreshTokenModel.deleteMany({
        $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
      })
      console.log('Cleaned up expired tokens')
    })
  ]
}
