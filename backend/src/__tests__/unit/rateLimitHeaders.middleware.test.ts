import { Request, Response } from 'express'
import {
  rateLimitExceededHandler,
  rateLimitHeadersMiddleware
} from '../../middlewares/rateLimitHeaders.middleware'
import { ErrorCodeEnum } from '../../enums/error-code.enum'

const createResponse = () => {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  }

  return res as unknown as Response
}

describe('rateLimitHeaders.middleware', () => {
  it('sets X-RateLimit headers when rate limit info exists', () => {
    const resetTime = new Date('2026-01-01T00:01:00.000Z')
    const req = {
      rateLimit: {
        limit: 100,
        used: 1,
        remaining: 99,
        resetTime,
        key: 'client'
      }
    } as Request
    const res = createResponse()
    const next = jest.fn()

    rateLimitHeadersMiddleware(req, res, next)

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99')
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      String(Math.ceil(resetTime.getTime() / 1000))
    )
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('continues without setting headers when rate limit info is absent', () => {
    const res = createResponse()
    const next = jest.fn()

    rateLimitHeadersMiddleware({} as Request, res, next)

    expect(res.setHeader).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('returns standardized 429 response with Retry-After', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const req = {
      correlationId: 'req-123',
      path: '/api/v1/transactions',
      method: 'GET',
      rateLimit: {
        limit: 100,
        used: 101,
        remaining: 0,
        resetTime: new Date('2026-01-01T00:00:30.000Z'),
        key: 'client'
      }
    } as Request
    const res = createResponse()

    rateLimitExceededHandler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '30')
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: ErrorCodeEnum.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
        requestId: 'req-123',
        path: '/api/v1/transactions',
        method: 'GET'
      })
    })

    jest.useRealTimers()
  })
})
