const mockAxiosGet = jest.fn()

jest.mock('axios', () => ({
  get: (...args: unknown[]) => mockAxiosGet(...args)
}))

jest.mock('../../utils/circuitBreaker.util', () => ({
  exchangeRateCircuitBreaker: {
    execute: (fn: () => Promise<unknown>) => fn()
  }
}))

import { redis } from '../../config/redis.config'
import { getExchangeRate } from '../../lib/exchange-rate-currency'

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
})
