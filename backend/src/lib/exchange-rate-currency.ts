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

const parseCachedRate = (value: string | null): number | null => {
  if (!value) return null

  const rate = Number(value)
  return Number.isFinite(rate) ? rate : null
}

const getCachedRate = async (
  key: string,
  label: string
): Promise<string | null> => {
  try {
    return await redis.get(key)
  } catch (error) {
    logger.warn(`[APP:Currency] ${label} cache read failed`, {
      error: error instanceof Error ? error.message : String(error),
      cacheKey: key
    })
    return null
  }
}

const setCachedRate = async (
  key: string,
  rate: number,
  ttlSeconds: number,
  label: string
) => {
  try {
    await redis.set(key, rate.toString(), 'EX', ttlSeconds)
  } catch (error) {
    logger.warn(`[APP:Currency] ${label} cache write failed`, {
      error: error instanceof Error ? error.message : String(error),
      cacheKey: key
    })
  }
}

const parseProviderRate = (
  value: unknown,
  from: CurrencyType | string,
  to: CurrencyType | string
) => {
  const rate = Number(value)
  if (!Number.isFinite(rate)) {
    throw new Error(`Invalid exchange rate for ${from} to ${to}`)
  }
  return rate
}

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
  const cached = await getCachedRate(cacheKey, 'Exchange rate')
  const cachedRate = parseCachedRate(cached)
  if (cachedRate !== null) return cachedRate

  if (cached) {
    logger.warn(`[APP:Currency] Ignoring invalid cached exchange rate`, {
      from,
      to,
      cacheKey
    })
  }

  try {
    const res = await fetchExchangeRatesWithFallback(from)
    const rate = parseProviderRate(res.data.rates[to], from, to)

    await Promise.allSettled([
      setCachedRate(cacheKey, rate, RATE_CACHE_TTL_SECONDS, 'Exchange rate'),
      setCachedRate(
        staleRateCacheKey(from, to),
        rate,
        STALE_RATE_CACHE_TTL_SECONDS,
        'Stale exchange rate'
      )
    ])

    return rate
  } catch (error) {
    const staleCacheKey = staleRateCacheKey(from, to)
    const staleRate = await getCachedRate(staleCacheKey, 'Stale exchange rate')
    const parsedStaleRate = parseCachedRate(staleRate)
    if (parsedStaleRate !== null) {
      logger.warn(
        `[APP:Currency] Using stale exchange rate: ${from} to ${to}`,
        {
          error: error instanceof Error ? error.message : String(error),
          from,
          to
        }
      )
      return parsedStaleRate
    }

    if (staleRate) {
      logger.warn(`[APP:Currency] Ignoring invalid stale exchange rate`, {
        from,
        to,
        cacheKey: staleCacheKey
      })
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
