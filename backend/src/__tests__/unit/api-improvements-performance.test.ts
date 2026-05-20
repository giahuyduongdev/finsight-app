import { Request } from 'express'
import { CircuitBreaker } from '../../utils/circuitBreaker.util'
import { ResponseFormatter } from '../../utils/responseFormatter.util'
import { healthCheckController } from '../../controllers/health.controller'

jest.mock('../../config/logger.config', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('../../utils/healthCheck.util', () => ({
  checkMongoDB: jest.fn().mockResolvedValue({ status: 'up', responseTime: 1 }),
  checkRedis: jest.fn().mockResolvedValue({ status: 'up', responseTime: 1 }),
  checkBullMQ: jest.fn().mockResolvedValue({ status: 'up', responseTime: 1 })
}))

const createRequest = (): Request =>
  ({
    protocol: 'https',
    path: '/api/v1/transactions',
    get: jest.fn(() => 'api.example.com')
  }) as unknown as Request

describe('API improvements performance smoke tests', () => {
  it('keeps circuit breaker overhead below 1ms per operation on average', async () => {
    const breaker = new CircuitBreaker()
    const iterations = 1000
    const start = performance.now()

    for (let i = 0; i < iterations; i += 1) {
      await breaker.execute(() => Promise.resolve(i), 'Perf Service')
    }

    const averageMs = (performance.now() - start) / iterations
    expect(averageMs).toBeLessThan(1)
  })

  it('formats paginated responses quickly under repeated use', () => {
    const iterations = 10000
    const req = createRequest()
    const start = performance.now()

    for (let i = 0; i < iterations; i += 1) {
      ResponseFormatter.paginated(
        [],
        { pageNumber: 1, pageSize: 10, totalCount: 100, totalPages: 10 },
        req
      )
    }

    expect(performance.now() - start).toBeLessThan(1000)
  })

  it('responds to health checks quickly when dependencies are healthy', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    const start = performance.now()

    await healthCheckController({} as Request, res as never)

    expect(performance.now() - start).toBeLessThan(100)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
