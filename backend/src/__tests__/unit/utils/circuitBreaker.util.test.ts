import {
  CircuitBreaker,
  CircuitState
} from '../../../utils/circuitBreaker.util'
import { ErrorCodeEnum } from '../../../enums/error-code.enum'
import { AppError } from '../../../utils/errors/index'

jest.mock('../../../config/logger.config', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('starts in CLOSED state', () => {
    const breaker = new CircuitBreaker()

    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(breaker.getFailureCount()).toBe(0)
  })

  it('opens after 5 consecutive failures by default', async () => {
    const breaker = new CircuitBreaker()
    const error = new Error('service failed')

    for (let i = 0; i < 5; i += 1) {
      await expect(
        breaker.execute(() => Promise.reject(error), 'Test Service')
      ).rejects.toThrow('service failed')
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN)
    expect(breaker.getFailureCount()).toBe(5)
  })

  it('rejects requests immediately when OPEN', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1 })
    const operation = jest.fn().mockRejectedValue(new Error('service failed'))

    await expect(breaker.execute(operation, 'Test Service')).rejects.toThrow(
      'service failed'
    )
    operation.mockClear()

    await expect(
      breaker.execute(operation, 'Test Service')
    ).rejects.toMatchObject({
      errorCode: ErrorCodeEnum.CIRCUIT_BREAKER_OPEN,
      statusCode: 503
    } satisfies Partial<AppError>)
    expect(operation).not.toHaveBeenCalled()
  })

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 30000
    })

    await expect(
      breaker.execute(
        () => Promise.reject(new Error('service failed')),
        'Test Service'
      )
    ).rejects.toThrow('service failed')

    jest.advanceTimersByTime(30000)

    await breaker.execute(() => Promise.resolve('ok'), 'Test Service')

    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })

  it('closes on successful test request in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000
    })

    await expect(
      breaker.execute(
        () => Promise.reject(new Error('service failed')),
        'Test Service'
      )
    ).rejects.toThrow('service failed')

    jest.advanceTimersByTime(1000)

    const result = await breaker.execute(
      () => Promise.resolve('recovered'),
      'Test Service'
    )

    expect(result).toBe('recovered')
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
    expect(breaker.getFailureCount()).toBe(0)
  })

  it('reopens on failed test request in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 1000
    })

    await expect(
      breaker.execute(
        () => Promise.reject(new Error('initial failure')),
        'Test Service'
      )
    ).rejects.toThrow('initial failure')

    jest.advanceTimersByTime(1000)

    await expect(
      breaker.execute(
        () => Promise.reject(new Error('still failing')),
        'Test Service'
      )
    ).rejects.toThrow('still failing')

    expect(breaker.getState()).toBe(CircuitState.OPEN)
  })

  it('resets failure count after a successful operation', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 5 })

    await expect(
      breaker.execute(
        () => Promise.reject(new Error('temporary failure')),
        'Test Service'
      )
    ).rejects.toThrow('temporary failure')

    await breaker.execute(() => Promise.resolve('ok'), 'Test Service')

    expect(breaker.getFailureCount()).toBe(0)
    expect(breaker.getState()).toBe(CircuitState.CLOSED)
  })
})
