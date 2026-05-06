import axios from 'axios'
import { redis } from '../config/redis.config'
import { CurrencyType } from '../enums/currency.enum'
import { logger } from '../config/logger.config'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

export const getExchangeRate = async (
  from: CurrencyType | string,
  to: CurrencyType | string
): Promise<number> => {
  // Nếu cùng currency → tỉ giá = 1
  if (from === to) return 1

  // Check Redis cache trước
  const cacheKey = `rate:${from}:${to}`
  const cached = await redis.get(cacheKey)
  if (cached) return parseFloat(cached)

  try {
    // Gọi API lấy tỉ giá mới (Fallback)
    const res = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${from}`
    )
    const rate = res.data.rates[to]

    if (!rate) throw new Error(`Exchange rate not found for ${from} to ${to}`)

    // Cache 1 giờ (dành cho fallback)
    await redis.set(cacheKey, rate.toString(), 'EX', 3600)

    return rate
  } catch (error) {
    logger.error(
      logIcon(
        LOG_ICONS.ERROR,
        `[Currency] Fallback rate fetch failed: ${from} to ${to}`
      ),
      (error as Error).message
    )
    // Nếu có tỉ giá cũ trong cache (dù đã hết hạn hoặc fallback cứng) thì có thể trả về 0 hoặc throw
    throw error
  }
}
