const mockAxiosGet = jest.fn()

jest.mock('axios', () => ({
  get: (...args: unknown[]) => mockAxiosGet(...args)
}))

jest.mock('../../../utils/circuitBreaker.util', () => ({
  exchangeRateCircuitBreaker: {
    execute: (fn: () => Promise<unknown>) => fn()
  }
}))

import { redis } from '../../../config/redis.config'
import { getExchangeRate } from '../../../lib/exchange-rate-currency'

describe('exchange-rate-currency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should ignore invalid cached exchange rates and use valid stale rates', async () => {
    ;(redis.get as jest.Mock)
      .mockResolvedValueOnce('not-a-number')
      .mockResolvedValueOnce('0.000041')
    mockAxiosGet.mockRejectedValue(new Error('network failed'))

    await expect(getExchangeRate('VND', 'USD')).resolves.toBe(0.000041)
  })

  it('should reject invalid current and stale cached exchange rates', async () => {
    ;(redis.get as jest.Mock)
      .mockResolvedValueOnce('not-a-number')
      .mockResolvedValueOnce('also-not-a-number')
    mockAxiosGet.mockRejectedValue(new Error('network failed'))

    await expect(getExchangeRate('VND', 'USD')).rejects.toThrow(
      'network failed'
    )
  })

  it('should reject non-finite provider exchange rates without caching them', async () => {
    ;(redis.get as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
    mockAxiosGet.mockResolvedValue({
      data: {
        rates: {
          USD: 'not-a-number'
        }
      }
    })

    await expect(getExchangeRate('VND', 'USD')).rejects.toThrow(
      'Invalid exchange rate for VND to USD'
    )
    expect(redis.set).not.toHaveBeenCalled()
  })

  it('should ignore Redis cache write failures after provider success', async () => {
    ;(redis.get as jest.Mock).mockResolvedValueOnce(null)
    ;(redis.set as jest.Mock).mockRejectedValue(new Error('redis down'))
    mockAxiosGet.mockResolvedValue({
      data: {
        rates: {
          USD: 0.000041
        }
      }
    })

    await expect(getExchangeRate('VND', 'USD')).resolves.toBe(0.000041)
  })
})
