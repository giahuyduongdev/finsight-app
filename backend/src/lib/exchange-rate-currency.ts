import axios from 'axios'
import { redis } from '../config/redis.config'
import { CurrencyType } from '../enums/currency.enum'
import { logger } from '../config/logger.config'
import { Env } from '../config/env.config'
import { exchangeRateCircuitBreaker } from '../utils/circuitBreaker.util'

const buildRateUrl = (baseUrl: string, currency: CurrencyType | string) =>
  `${baseUrl.replace(/\/$/, '')}/${currency}`

const RATE_CACHE_TTL_SECONDS = 3600
const STALE_RATE_CACHE_TTL_SECONDS = 24 * 3600

const rateCacheKey = (from: CurrencyType | string, to: CurrencyType | string) =>
  `rate:${from}:${to}`

const staleRateCacheKey = (
  from: CurrencyType | string,
  to: CurrencyType | string
) => `rate:stale:${from}:${to}`

const fetchExchangeRatesWithFallbackInternal = async (
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

export const fetchExchangeRatesWithFallback = async (
  currency: CurrencyType | string
) =>
  exchangeRateCircuitBreaker.execute(
    () => fetchExchangeRatesWithFallbackInternal(currency),
    'Exchange Rate API'
  )

export const getExchangeRate = async (
  from: CurrencyType | string,
  to: CurrencyType | string
): Promise<number> => {
  // Nếu cùng currency → tỉ giá = 1
  if (from === to) return 1

  // Check Redis cache trước
  const cacheKey = rateCacheKey(from, to)
  const cached = await redis.get(cacheKey)
  if (cached) return parseFloat(cached)

  try {
    const res = await fetchExchangeRatesWithFallback(from)
    const rate = res.data.rates[to]

    if (!rate) throw new Error(`Exchange rate not found for ${from} to ${to}`)

    await Promise.all([
      redis.set(cacheKey, rate.toString(), 'EX', RATE_CACHE_TTL_SECONDS),
      redis.set(
        staleRateCacheKey(from, to),
        rate.toString(),
        'EX',
        STALE_RATE_CACHE_TTL_SECONDS
      )
    ])

    return rate
  } catch (error) {
    const staleRate = await redis.get(staleRateCacheKey(from, to))
    if (staleRate) {
      logger.warn(
        `[APP:Currency] Using stale exchange rate: ${from} to ${to}`,
        {
          error: error instanceof Error ? error.message : String(error),
          from,
          to
        }
      )
      return parseFloat(staleRate)
    }

    logger.error(
      `[APP:Currency] Fallback rate fetch failed: ${from} to ${to}`,
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        from,
        to
      }
    )
    throw error
  }
}
