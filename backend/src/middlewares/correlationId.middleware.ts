import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract from header or generate new UUID
  const rawHeader = req.headers['x-correlation-id']
  const candidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  const correlationId =
    candidate && /^[A-Za-z0-9._-]{1,128}$/.test(candidate)
      ? candidate
      : uuidv4()

  // Attach to request for downstream use
  req.correlationId = correlationId

  // Set response header
  res.setHeader('X-Correlation-ID', correlationId)

  next()
}
