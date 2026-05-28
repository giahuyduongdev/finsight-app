import cron from 'node-cron'
import { processRecurringTransactions } from './jobs/transaction.job'
import { processReportJob } from './jobs/report.job'

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
    scheduleJob('Transaction', '* * * * *', processRecurringTransactions),
    //run 2:30am every first of the month
    scheduleJob('Reports', '*/1 * * * *', processReportJob)
  ]
}
