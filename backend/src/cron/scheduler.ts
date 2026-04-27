import cron from 'node-cron'
import { processRecurringTransactions } from './jobs/transaction.job'
import { processReportJob } from './jobs/report.job'
import RefreshTokenModel from '../models/refresh-token.model'
import { logger } from '../config/logger.config'
import { redis } from '../config/redis.config'
import { CurrencyService } from '../services/currency.service'

const scheduleJob = (name: string, time: string, job: () => Promise<unknown> | unknown) => {
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
    scheduleJob('Currency Update', '*/30 * * * *', () => CurrencyService.fetchAndBroadcastRates()),

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
      // Xóa analytics cache mồ côi (không có TTL)
      const stream = redis.scanStream({
        match: 'analytics:*',
        count: 100
      })

      return new Promise<void>((resolve, reject) => {
        const keysFound: string[] = []
        stream.on('data', (keys) => keysFound.push(...keys))
        stream.on('error', (err) => reject(err))
        stream.on('end', async () => {
          try {
            if (keysFound.length > 0) {
              const pipeline = redis.pipeline()
              let orphansCount = 0
              for (const key of keysFound) {
                const ttl = await redis.ttl(key)
                if (ttl === -1) {
                  pipeline.unlink(key)
                  orphansCount++
                }
              }
              if (orphansCount > 0) {
                await pipeline.exec()
                logger.info(
                  `🧹 [Redis] Cleanup completed: ${orphansCount} orphaned analytics keys unlinked`
                )
              }
            }
            resolve()
          } catch (err) {
            reject(err)
          }
        })
      })
    })
  ]
}
