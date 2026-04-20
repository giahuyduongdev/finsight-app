import axios from 'axios'
import { redis } from '../config/redis.config'
import { getIO } from '../config/socket.config'
import { logger } from '../config/logger.config'
import { CurrencyEnum } from '../enums/currency.enum'

const CACHE_KEY_PREFIX = 'rate:'
const BROADCAST_EVENT = 'currency:rates_updated'

export class CurrencyService {
  /**
   * Fetch latest rates and broadcast via WebSocket
   * Base is VND by default to make it easy for the primary user
   */
  static async fetchAndBroadcastRates() {
    try {
      logger.info('🔄 [Currency] Fetching latest exchange rates...')
      
      // Lấy VND làm gốc để dễ tính toán cho người dùng VN
      const baseCurrency = CurrencyEnum.VND
      const response = await axios.get(
        `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`
      )

      const rates = response.data.rates
      if (!rates) throw new Error('Invalid response from exchange rate API')

      // Cập nhật Cache Redis cho tất cả các cặp tiền tệ phổ biến
      // Chúng ta sẽ lưu cả 2 chiều để tăng hiệu năng query sau này
      const currencies = Object.values(CurrencyEnum)
      const pipeline = redis.pipeline()

      for (const from of currencies) {
        for (const to of currencies) {
          if (from === to) continue

          // Tính toán tỉ giá chéo dựa trên base VND
          // Rate(A/B) = Rate(VND/B) / Rate(VND/A)
          const rateFromVNDtoA = rates[from]
          const rateFromVNDtoB = rates[to]

          if (rateFromVNDtoA && rateFromVNDtoB) {
            const crossRate = rateFromVNDtoB / rateFromVNDtoA
            pipeline.set(`${CACHE_KEY_PREFIX}${from}:${to}`, crossRate.toString(), 'EX', 86400) // Cache 24h as fallback
          }
        }
      }

      await pipeline.exec()
      logger.info('✅ [Currency] Cache updated in Redis')

      // Phát sóng qua WebSocket
      const io = getIO()
      io.emit(BROADCAST_EVENT, {
        base: baseCurrency,
        rates,
        updatedAt: new Date().toISOString()
      })
      
      logger.info(`📡 [Currency] Broadcasted rates to all clients`)
      return rates
    } catch (error) {
      logger.error('❌ [Currency] Error updating rates:', (error as Error).message)
      // Không ném lỗi ra ngoài để tránh làm hỏng cron job
      return null
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

      // Lấy tỉ giá so với VND từ cache
      let hasData = false
      for (const code of currencies) {
        if (code === baseCurrency) {
          rates[code] = 1
          continue
        }
        const val = await redis.get(`${CACHE_KEY_PREFIX}${baseCurrency}:${code}`)
        if (val) {
          rates[code] = parseFloat(val)
          hasData = true
        } else {
          rates[code] = 0
        }
      }

      // Nếu không có dữ liệu trong cache, thử kích hoạt fetch ngay lập tức
      if (!hasData) {
        logger.warn('⚠️ [Currency] Cache is empty, triggering manual fetch...')
        const fetchedRates = await CurrencyService.fetchAndBroadcastRates()
        if (fetchedRates) {
          return {
            base: baseCurrency,
            rates: fetchedRates,
            updatedAt: new Date().toISOString()
          }
        }
        throw new Error('Cache is empty and manual fetch failed')
      }

      return {
        base: baseCurrency,
        rates,
        updatedAt: new Date().toISOString()
      }
    } catch (error) {
      logger.error('❌ [Currency] Error getting rates from cache:', (error as Error).message)
      
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
}
