import { REDIS_KEYS, REDIS_TTL, redis } from '../config/redis.config'
import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'
import { CurrencyEnum } from '../enums/currency.enum'
import { BadRequestException, InternalServerException } from '../utils/errors'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { fetchExchangeRatesWithFallback } from '../lib/exchange-rate-currency'
import UserModel from '../models/user.model'
import { createSystemNotification } from '../utils/notification.util'
import crypto from 'crypto'

const CACHE_KEY_PREFIX = 'rate:'
const BROADCAST_EVENT = 'currency:rates_updated'
const RATE_CACHE_TTL_SECONDS = 86400

export class CurrencyService {
  /**
   * Fetch latest rates and broadcast via WebSocket
   * Base is VND by default to make it easy for the primary user
   */
  static async fetchAndBroadcastRates(options: { notifyUsers?: boolean } = {}) {
    try {
      logger.info('[APP:Currency] Fetching latest exchange rates...')

      // Lấy VND làm gốc để dễ tính toán cho người dùng VN
      const baseCurrency = CurrencyEnum.VND
      const response = await fetchExchangeRatesWithFallback(baseCurrency)

      const rates = response.data.rates
      if (!rates) {
        throw new BadRequestException(
          'Invalid response from exchange rate API',
          ErrorCodeEnum.VALIDATION_ERROR
        )
      }

      // Cập nhật Cache Redis cho tất cả các cặp tiền tệ phổ biến
      // Chúng ta sẽ lưu cả 2 chiều để tăng hiệu năng query sau này
      const currencies = Object.values(CurrencyEnum)
      const pipeline = redis.pipeline()
      const updatedAt = new Date().toISOString()

      for (const from of currencies) {
        for (const to of currencies) {
          if (from === to) continue

          // Tính toán tỉ giá chéo dựa trên base VND
          // Rate(A/B) = Rate(VND/B) / Rate(VND/A)
          const rateFromVNDtoA = rates[from]
          const rateFromVNDtoB = rates[to]

          if (rateFromVNDtoA && rateFromVNDtoB) {
            const crossRate = rateFromVNDtoB / rateFromVNDtoA
            pipeline.set(
              `${CACHE_KEY_PREFIX}${from}:${to}`,
              crossRate.toString(),
              'EX',
              RATE_CACHE_TTL_SECONDS
            ) // Cache 24h as fallback
          }
        }
      }

      pipeline.set(
        REDIS_KEYS.currencyRatesUpdatedAt,
        updatedAt,
        'EX',
        RATE_CACHE_TTL_SECONDS
      )

      const results = await pipeline.exec()

      // Check for partial failures in pipeline execution
      if (results) {
        const failures = results.filter(([err]) => err !== null)
        if (failures.length > 0) {
          logger.warn(
            `[APP:Currency] ${failures.length} cache operations failed`
          )
        }
      }

      logger.info('[APP:Currency] Cache updated in Redis')

      // Phát sóng qua WebSocket
      const io = getIO()
      io.emit(BROADCAST_EVENT, {
        base: baseCurrency,
        rates,
        updatedAt
      })

      logger.info('[APP:Currency] Broadcasted rates to all clients')

      if (options.notifyUsers) {
        await CurrencyService.notifyUsersRatesUpdated(updatedAt)
      }

      return rates
    } catch (error) {
      logger.error('[APP:Currency] Error updating rates', {
        error: (error as Error).message,
        stack: (error as Error).stack
      })
      // Không ném lỗi ra ngoài để tránh làm hỏng cron job
      return null
    }
  }

  private static async notifyUsersRatesUpdated(updatedAt: string) {
    try {
      const users = await UserModel.find({}, { _id: 1 }).lean()

      await Promise.all(
        users.map((user) =>
          createSystemNotification({
            userId: user._id.toString(),
            type: 'currency.rates_updated',
            title: 'Exchange rates updated',
            description: 'Latest currency rates are ready to use',
            severity: 'success',
            actionUrl: '/rates',
            metadata: {
              entityType: 'rate',
              source: 'scheduled'
            },
            idempotencyKey: `currency-rates:${user._id.toString()}:${updatedAt}`
          })
        )
      )
    } catch (error) {
      logger.warn('[APP:Currency] Failed to create rates notifications', {
        updatedAt,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Get latest rates from Redis cache
   */
  static async getLatestRates() {
    try {
      const currencies = Object.values(CurrencyEnum)
      const baseCurrency = CurrencyEnum.VND
      const rates: Record<string, number> = {}
      const cachedUpdatedAt = await redis.get(REDIS_KEYS.currencyRatesUpdatedAt)

      // Lấy tỉ giá so với VND từ cache - Optimized with mget
      let hasData = false

      // Build keys array for mget
      const keys: string[] = []
      const keyToCurrency: Record<string, string> = {}

      for (const code of currencies) {
        if (code === baseCurrency) {
          rates[code] = 1
          continue
        }
        const key = `${CACHE_KEY_PREFIX}${baseCurrency}:${code}`
        keys.push(key)
        keyToCurrency[key] = code
      }

      // Single mget call instead of N redis.get calls
      if (keys.length > 0) {
        const values = await redis.mget(...keys)

        for (let i = 0; i < keys.length; i++) {
          const code = keyToCurrency[keys[i]]
          const val = values[i]

          if (val) {
            rates[code] = parseFloat(val)
            hasData = true
          } else {
            rates[code] = 0
          }
        }
      }

      // Nếu không có dữ liệu trong cache, thử kích hoạt fetch ngay lập tức
      if (!hasData) {
        logger.warn('[APP:Currency] Cache is empty, triggering manual fetch...')
        const fetchedRates = await CurrencyService.fetchAndBroadcastRates()
        if (fetchedRates) {
          return {
            base: baseCurrency,
            rates: fetchedRates,
            updatedAt:
              (await redis.get(REDIS_KEYS.currencyRatesUpdatedAt)) ||
              new Date().toISOString()
          }
        }
        throw new InternalServerException(
          'Cache is empty and manual fetch failed',
          ErrorCodeEnum.INTERNAL_SERVER_ERROR
        )
      }

      return {
        base: baseCurrency,
        rates,
        updatedAt: cachedUpdatedAt || new Date().toISOString()
      }
    } catch (error) {
      logger.error('[APP:Currency] Error getting rates from cache', {
        error: (error as Error).message,
        stack: (error as Error).stack
      })

      // Fallback cứng nếu Redis trống hoàn toàn (cho lần đầu chạy hoặc lỗi nặng)
      return {
        base: CurrencyEnum.VND,
        rates: {
          [CurrencyEnum.VND]: 1,
          [CurrencyEnum.USD]: 0.000041,
          [CurrencyEnum.EUR]: 0.000038,
          [CurrencyEnum.JPY]: 0.0062,
          [CurrencyEnum.GBP]: 0.000032,
          [CurrencyEnum.CNY]: 0.00029
        },
        updatedAt: new Date().toISOString()
      }
    }
  }

  static async refreshRatesManually() {
    let lockAcquired = false
    const lockToken = crypto.randomUUID()

    try {
      const lockResult = await redis.set(
        REDIS_KEYS.currencyManualRefreshLock,
        lockToken,
        'EX',
        REDIS_TTL.CURRENCY_MANUAL_REFRESH_LOCK,
        'NX'
      )
      lockAcquired = !!lockResult

      if (!lockAcquired) {
        logger.info('[APP:Currency] Manual refresh skipped due to throttle')
        return CurrencyService.getLatestRates()
      }

      const fetchedRates = await CurrencyService.fetchAndBroadcastRates()
      const baseCurrency = CurrencyEnum.VND

      if (fetchedRates) {
        return {
          base: baseCurrency,
          rates: fetchedRates,
          updatedAt:
            (await redis.get(REDIS_KEYS.currencyRatesUpdatedAt)) ||
            new Date().toISOString()
        }
      }
    } catch (error) {
      logger.error('[APP:Currency] Manual refresh failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    } finally {
      if (lockAcquired) {
        try {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            REDIS_KEYS.currencyManualRefreshLock,
            lockToken
          )
        } catch (error) {
          logger.warn('[APP:Currency] Failed to release manual refresh lock', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    return CurrencyService.getLatestRates()
  }
}
