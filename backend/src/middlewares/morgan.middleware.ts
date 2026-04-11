import morgan, { TokenIndexer } from 'morgan'
import { IncomingMessage, ServerResponse } from 'http'
import { Request, Response } from 'express'
import { Env } from '../config/env.config'
import { logger } from '../config/logger.config'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getMethodIcon = (method: string): string => {
  switch (method) {
    case 'GET':
      return '📥'
    case 'POST':
      return '📤'
    case 'PUT':
    case 'PATCH':
      return '🔄'
    case 'DELETE':
      return '❌'
    default:
      return '🌐'
  }
}

const getStatusIcon = (status: number): string => {
  if (status >= 500) return '🔴'
  if (status >= 400) return '🟡'
  if (status >= 300) return '🔵'
  if (status >= 200) return '🟢'
  return '⚪'
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

          return `${getMethodIcon(method)} ${method} ${url} | ${getStatusIcon(status)} Status: ${status} | ⏱️  ${responseTime} ms`
        },
        { stream, skip }
      )
