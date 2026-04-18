import cron from 'node-cron'
import { processRecurringTransactions } from './jobs/transaction.job'
import { processReportJob } from './jobs/report.job'
import RefreshTokenModel from '../models/refresh-token.model'
import { logger } from '../config/logger.config'
import { redis } from '../config/redis.config'

const scheduleJob = (name: string, time: string, job: Function) => {
  logger.info(`🗓️  [Scheduling] ${name} at ${time}`)

  return cron.schedule(
    time,
    async () => {
      try {
        await job()
        logger.info(`🏁 ${name} completed`)
      } catch (error) {
        logger.error(`${name} failed`, error)
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

    //Run 2:30am every first of the month
    scheduleJob('Reports', '30 2 1 * *', processReportJob),

    // Chạy 00:00 mỗi ngày
    scheduleJob('Cleanup Tokens', '0 0 * * *', async () => {
      await RefreshTokenModel.deleteMany({
        $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
      })
      logger.info('🧹 [Refresh Token] Cleaned up expired tokens')
    }),

    scheduleJob('Redis Cleanup', '0 3 * * *', async () => {
      // Xóa analytics cache cũ hơn 7 ngày
      const keys = await redis.keys('analytics:*')
      const pipeline = redis.pipeline()

      for (const key of keys) {
        const ttl = await redis.ttl(key)
        if (ttl === -1) {
          // key không có TTL → xóa luôn
          pipeline.del(key)
        }
      }

      await pipeline.exec()
      logger.info('🧹 [Redis] Cleanup completed')
    })
  ]
}
