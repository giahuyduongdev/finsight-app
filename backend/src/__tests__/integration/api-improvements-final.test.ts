import express, { NextFunction } from 'express'
import request from 'supertest'
import { z } from 'zod'
import { correlationIdMiddleware } from '../../middlewares/correlationId.middleware'
import { requestContextMiddleware } from '../../middlewares/requestContext.middleware'
import {
  rateLimitExceededHandler,
  rateLimitHeadersMiddleware
} from '../../middlewares/rateLimitHeaders.middleware'
import { errorHandler } from '../../middlewares/errorHandler.middleware'
import { validate } from '../../middlewares/validate.middleware'
import { healthCheckController } from '../../controllers/health.controller'
import { AppError } from '../../utils/errors/index'
import { ErrorCodeEnum } from '../../enums/error-code.enum'
import { HTTPSTATUS } from '../../config/http.config'

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

const createApp = () => {
  const app = express()
  const resetTime = new Date(Date.now() + 60_000)

  app.use(express.json())
  app.use(correlationIdMiddleware)
  app.use(requestContextMiddleware)
  app.use((req, _res, next) => {
    req.rateLimit = {
      limit: 100,
      used: 1,
      remaining: 99,
      resetTime,
      key: 'test-client'
    }
    next()
  })
  app.use(rateLimitHeadersMiddleware)

  app.get('/health', healthCheckController)
  app.get('/transactions', (_req, res) => {
    res.json({ data: [] })
  })
  app.post(
    '/validate',
    validate(z.object({ email: z.string().email() }), 'body'),
    (_req, res) => res.json({ data: { ok: true } })
  )
  app.get('/server-error', (_req, _res, next: NextFunction) => {
    next(
      new AppError(
        'Service failed',
        HTTPSTATUS.INTERNAL_SERVER_ERROR,
        ErrorCodeEnum.INTERNAL_SERVER_ERROR
      )
    )
  })
  app.get('/limited', rateLimitExceededHandler)
  app.use(errorHandler)

  return app
}

describe('API improvements final integration', () => {
  it('tracks correlation ID and rate limit headers through a successful request', async () => {
    const response = await request(createApp())
      .get('/transactions')
      .set('X-Correlation-ID', 'req-final-123')

    expect(response.status).toBe(HTTPSTATUS.OK)
    expect(response.headers['x-correlation-id']).toBe('req-final-123')
    expect(response.headers['x-ratelimit-limit']).toBe('100')
    expect(response.headers['x-ratelimit-remaining']).toBe('99')
    expect(response.headers['x-ratelimit-reset']).toBeDefined()
    expect(response.body).toEqual({ data: [] })
  })

  it('returns standardized validation error responses', async () => {
    const response = await request(createApp())
      .post('/validate')
      .set('X-Correlation-ID', 'req-validation-123')
      .send({ email: 'invalid' })

    expect(response.status).toBe(HTTPSTATUS.BAD_REQUEST)
    expect(response.body.error).toMatchObject({
      code: ErrorCodeEnum.VALIDATION_ERROR,
      requestId: 'req-validation-123',
      path: '/validate',
      method: 'POST'
    })
    expect(response.body.error.details).toEqual([
      { field: 'email', message: 'Invalid email' }
    ])
  })

  it('returns standardized 5xx errors without losing request context', async () => {
    const response = await request(createApp())
      .get('/server-error')
      .set('X-Correlation-ID', 'req-error-123')

    expect(response.status).toBe(HTTPSTATUS.INTERNAL_SERVER_ERROR)
    expect(response.body.error).toMatchObject({
      code: ErrorCodeEnum.INTERNAL_SERVER_ERROR,
      requestId: 'req-error-123',
      userMessage: 'Something went wrong. Please try again later',
      path: '/server-error',
      method: 'GET'
    })
  })

  it('returns health check status with dependency details', async () => {
    const response = await request(createApp()).get('/health')

    expect(response.status).toBe(HTTPSTATUS.OK)
    expect(response.body).toMatchObject({
      status: 'healthy',
      checks: {
        mongodb: { status: 'up' },
        redis: { status: 'up' },
        bullmq: { status: 'up' }
      }
    })
  })

  it('returns standardized 429 responses with retry metadata', async () => {
    const response = await request(createApp())
      .get('/limited')
      .set('X-Correlation-ID', 'req-rate-123')

    expect(response.status).toBe(HTTPSTATUS.TOO_MANY_REQUESTS)
    expect(response.headers['retry-after']).toBeDefined()
    expect(response.body.error).toMatchObject({
      code: ErrorCodeEnum.RATE_LIMIT_EXCEEDED,
      requestId: 'req-rate-123',
      statusCode: HTTPSTATUS.TOO_MANY_REQUESTS
    })
  })
})
