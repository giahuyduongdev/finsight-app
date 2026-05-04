import cron from 'node-cron'
import { processRecurringTransactions } from './jobs/transaction.job'
import { processReportJob } from './jobs/report.job'
import RefreshTokenModel from '../models/refresh-token.model'
import { logger } from '../config/logger.config'
import { redis } from '../config/redis.config'
import { CurrencyService } from '../services/currency.service'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

const scheduleJob = (
  name: string,
  time: string,
  job: () => Promise<unknown> | unknown
) => {
  logger.info(logIcon(LOG_ICONS.SCHEDULE, ` [Scheduling] ${name} at ${time}`))

  return cron.schedule(
    time,
    async () => {
      try {
        await job()
        logger.info(logIcon(LOG_ICONS.SUCCESS, `${name} completed`))
      } catch (error) {
        logger.error(logIcon(LOG_ICONS.ERROR, `${name} failed`), error)
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
    scheduleJob('Currency Update', '*/30 * * * *', () =>
      CurrencyService.fetchAndBroadcastRates()
    ),

    //Run 2:30am every first of the month
    scheduleJob('Reports', '30 2 1 * *', processReportJob),

    // Chạy 00:00 mỗi ngày
    scheduleJob('Cleanup Tokens', '0 0 * * *', async () => {
      await RefreshTokenModel.deleteMany({
        $or: [{ isRevoked: true }, { expiresAt: { $lt: new Date() } }]
      })
      logger.info(
        logIcon(LOG_ICONS.DELETE, '[Refresh Token] Cleaned up expired tokens')
      )
    }),

    scheduleJob('Redis Cleanup', '0 3 * * *', async () => {
      // Xóa analytics cache mồ côi (không có TTL)
      const stream = redis.scanStream({
        match: 'analytics:*',
        count: 100
      })

      let orphansCount = 0
      let draining = Promise.resolve()

      return new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          stream.pause()
          draining = draining
            .then(async () => {
              if (keys.length === 0) return

              // Pipeline TTL checks for the current chunk
              const ttlPipeline = redis.pipeline()
              for (const key of keys) {
                ttlPipeline.ttl(key)
              }
              const ttlResults = await ttlPipeline.exec()

              // Filter out keys that don't have a TTL (-1)
              const orphanKeys = keys.filter(
                (_, index) => ttlResults?.[index]?.[1] === -1
              )

              if (orphanKeys.length > 0) {
                await redis.unlink(...orphanKeys)
                orphansCount += orphanKeys.length
              }
            })
            .then(() => {
              stream.resume()
            })
            .catch(reject)
        })

        stream.on('error', (err) => reject(err))

        stream.on('end', () => {
          draining
            .then(() => {
              if (orphansCount > 0) {
                logger.info(
                  logIcon(
                    LOG_ICONS.DELETE,
                    `[Redis] Cleanup completed: ${orphansCount} orphaned analytics keys unlinked`
                  )
                )
              }
              resolve()
            })
            .catch(reject)
        })
      })
    })
  ]
}
