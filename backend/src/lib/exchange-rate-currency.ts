import axios from 'axios'
import { redis } from '../config/redis.config'
import { CurrencyType } from '../enums/currency.enum'
import { logger } from '../config/logger.config'
import { Env } from '../config/env.config'

const buildRateUrl = (baseUrl: string, currency: CurrencyType | string) =>
  `${baseUrl.replace(/\/$/, '')}/${currency}`

export const fetchExchangeRatesWithFallback = async (
  currency: CurrencyType | string
) => {
  try {
    return await axios.get(
      buildRateUrl(Env.EXCHANGE_RATE_PRIMARY_API_URL, currency),
      { timeout: 10000 }
    )
  } catch (error) {
    if (!Env.EXCHANGE_RATE_FALLBACK_API_URL) throw error

    logger.warn(
      '[APP:Currency] Primary exchange rate API failed, trying fallback',
      {
        error: error instanceof Error ? error.message : String(error),
        currency
      }
    )

    return await axios.get(
      buildRateUrl(Env.EXCHANGE_RATE_FALLBACK_API_URL, currency),
      { timeout: 10000 }
    )
  }
}

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
    const res = await fetchExchangeRatesWithFallback(from)
    const rate = res.data.rates[to]

    if (!rate) throw new Error(`Exchange rate not found for ${from} to ${to}`)

    // Cache 1 giờ (dành cho fallback)
    await redis.set(cacheKey, rate.toString(), 'EX', 3600)

    return rate
  } catch (error) {
    logger.error(
      `[APP:Currency] Fallback rate fetch failed: ${from} to ${to}`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        from,
        to
      }
    )
    // Nếu có tỉ giá cũ trong cache (dù đã hết hạn hoặc fallback cứng) thì có thể trả về 0 hoặc throw
    throw error
  }
}
