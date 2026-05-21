import { NextFunction, Request, Response } from 'express'
import { HTTPSTATUS } from '../config/http.config'
import { ErrorCodeEnum } from '../enums/error-code.enum'
import { getUserMessage } from '../utils/userMessage.util'

const getResetUnixTimestamp = (resetTime?: Date): number =>
  resetTime
    ? Math.ceil(resetTime.getTime() / 1000)
    : Math.ceil(Date.now() / 1000)

export const rateLimitHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.rateLimit) {
    res.setHeader('X-RateLimit-Limit', String(req.rateLimit.limit))
    res.setHeader('X-RateLimit-Remaining', String(req.rateLimit.remaining))
    res.setHeader(
      'X-RateLimit-Reset',
      String(getResetUnixTimestamp(req.rateLimit.resetTime))
    )
  }

  next()
}

export const rateLimitExceededHandler = (req: Request, res: Response): void => {
  const resetTimestamp = getResetUnixTimestamp(req.rateLimit?.resetTime)
  const retryAfter = Math.max(resetTimestamp - Math.ceil(Date.now() / 1000), 1)

  res.setHeader('Retry-After', String(retryAfter))
  res.status(HTTPSTATUS.TOO_MANY_REQUESTS).json({
    error: {
      code: ErrorCodeEnum.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
      userMessage: getUserMessage(
        { errorCode: ErrorCodeEnum.RATE_LIMIT_EXCEEDED },
        HTTPSTATUS.TOO_MANY_REQUESTS
      ),
      statusCode: HTTPSTATUS.TOO_MANY_REQUESTS,
      requestId: req.correlationId || 'unknown',
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    }
  })
}
