import morgan, { TokenIndexer } from 'morgan'
import { IncomingMessage, ServerResponse } from 'http'
import { Request } from 'express'
import { Env } from '../config/env.config'
import { logger } from '../config/logger.config'
import { logIcon, LOG_ICONS } from '../utils/logger-icon.util'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getMethodIcon = (method: string): string => {
  switch (method) {
    case 'GET':
      return logIcon(LOG_ICONS.GLOBE, '')
    case 'POST':
      return logIcon(LOG_ICONS.GLOBE, '')
    case 'PUT':
    case 'PATCH':
      return logIcon(LOG_ICONS.REFRESH, '')
    case 'DELETE':
      return logIcon(LOG_ICONS.DELETE, '')
    default:
      return logIcon(LOG_ICONS.GLOBE, '')
  }
}

const getStatusIcon = (status: number): string => {
  if (status >= 500) return logIcon(LOG_ICONS.ERROR, '')
  if (status >= 400) return logIcon(LOG_ICONS.WARNING, '')
  if (status >= 300) return logIcon(LOG_ICONS.INFO, '')
  if (status >= 200) return logIcon(LOG_ICONS.SUCCESS, '')
  return logIcon(LOG_ICONS.INFO, '')
}

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

          return `${getMethodIcon(method)} ${method} ${url} | ${getStatusIcon(status)} Status: ${status} | ${logIcon(LOG_ICONS.TIME, '')} ${responseTime} ms`
        },
        { stream, skip }
      )
