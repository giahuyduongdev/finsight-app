import morgan, { TokenIndexer } from 'morgan'
import { IncomingMessage, ServerResponse } from 'http'
import { Request, Response } from 'express'
import { isProduction } from '../config/app.config'
import { logger } from '../config/logger.config'

// ─── Custom Format ────────────────────────────────────────────────────────────

const customFormat = (
  tokens: TokenIndexer<IncomingMessage, ServerResponse>,
  req: IncomingMessage,
  res: ServerResponse
): string => {
  const method = tokens.method(req, res) || 'UNKNOWN'
  const url = tokens.url(req, res) || 'UNKNOWN'
  const status = Number(tokens.status(req, res)) || 0
  const responseTime = tokens['response-time'](req, res) || '0'

  return `[APP:Server] ${method} ${url} | Status: ${status} | ${responseTime} ms`
}

// ─── Success Logger (200-399) ─────────────────────────────────────────────────

export const successLogger = isProduction()
  ? morgan('combined', {
      skip: (req: Request, res: Response) => res.statusCode >= 400,
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    })
  : morgan(customFormat, {
      skip: (req: Request, res: Response) => res.statusCode >= 400,
      stream: {
        write: (message: string) => logger.info(message.trim())
      }
    })

// ─── Error Logger (400+) ──────────────────────────────────────────────────────

export const errorLogger = isProduction()
  ? morgan('combined', {
      skip: (req: Request, res: Response) => res.statusCode < 400,
      stream: {
        write: (message: string) => logger.error(message.trim())
      }
    })
  : morgan(customFormat, {
      skip: (req: Request, res: Response) => res.statusCode < 400,
      stream: {
        write: (message: string) => logger.error(message.trim())
      }
    })
