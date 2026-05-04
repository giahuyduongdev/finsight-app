import { Request, Response, NextFunction } from 'express'
import { asyncLocalStorage } from '../utils/asyncContext'

/**
 * Request context middleware
 * Populates AsyncLocalStorage with request context for automatic propagation
 * This allows logger and other utilities to access request context without explicit passing
 */
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Create context object with request metadata
  const context = {
    correlationId: req.correlationId,
    userId: req.user?.id,
    method: req.method,
    path: req.path,
    startTime: Date.now()
  }

  // Run the rest of the request handling within this context
  asyncLocalStorage.run(context, () => {
    // Track response finish event to calculate duration
    res.on('finish', () => {
      // Duration is available for logging in other parts of the application
      // const duration = Date.now() - context.startTime!
    })

    next()
  })
}
