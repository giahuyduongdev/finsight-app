import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract from header or generate new UUID
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4()

  // Attach to request for downstream use
  req.correlationId = correlationId

  // Set response header
  res.setHeader('X-Correlation-ID', correlationId)

  next()
}
