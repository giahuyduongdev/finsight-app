import morgan, { TokenIndexer } from 'morgan'
import { IncomingMessage, ServerResponse } from 'http'
import { Request } from 'express'
import { Env } from '../config/env.config'
import { logger } from '../config/logger.config'

// ─── Stream ───────────────────────────────────────────────────────────────────

const stream = {
  write: (message: string) => logger.http(message.trim())
}

const skip = (req: Request) => req.method === 'OPTIONS'

// ─── Morgan Middleware ────────────────────────────────────────────────────────

export const morganMiddleware =
  Env.NODE_ENV === 'production'
    ? morgan('combined', { stream, skip })
    : morgan(
        (
          tokens: TokenIndexer<IncomingMessage, ServerResponse>,
          req: IncomingMessage,
          res: ServerResponse
        ): string => {
          const method = tokens.method(req, res) || 'UNKNOWN'
          const url = tokens.url(req, res) || 'UNKNOWN'
          const status = Number(tokens.status(req, res)) || 0
          const responseTime = tokens['response-time'](req, res) || '0'

          return `${method} ${url} | Status: ${status} | ${responseTime} ms`
        },
        { stream, skip }
      )
