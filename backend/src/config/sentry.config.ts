import * as Sentry from '@sentry/node'
import type { Express, Request } from 'express'
import { Env } from './env.config'
import { logger } from './logger.config'

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|authentication|cookie|set-cookie|x-.*(token|key|auth)|.*(token|key|auth).*)$/i

export const scrubSentryEvent = (
  event: Sentry.ErrorEvent
): Sentry.ErrorEvent => {
  const headers = event.request?.headers
  if (!headers) return event

  for (const header of Object.keys(headers)) {
    if (SENSITIVE_HEADER_PATTERN.test(header)) {
      headers[header] = '[REDACTED]'
    }
  }

  return event
}

export const initSentry = (_app?: Express): void => {
  if (!Env.SENTRY_DSN) {
    logger.info('[APP:Sentry] SENTRY_DSN not configured, skipping init')
    return
  }

  Sentry.init({
    dsn: Env.SENTRY_DSN,
    environment: Env.NODE_ENV,
    tracesSampleRate: Env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [Sentry.expressIntegration()],
    beforeSend: (event) => scrubSentryEvent(event)
  })
}

export const captureSentryError = (
  error: unknown,
  req: Request,
  statusCode: number
): void => {
  if (!Env.SENTRY_DSN || statusCode < 500) return

  try {
    Sentry.withScope((scope) => {
      scope.setTag('requestId', req.correlationId || 'unknown')
      scope.setTag('path', req.path)
      scope.setTag('method', req.method)
      scope.setContext('request', {
        requestId: req.correlationId || 'unknown',
        path: req.path,
        method: req.method
      })

      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        scope.setUser({ id: String(req.user.id) })
      }

      Sentry.captureException(error)
    })
  } catch (sentryError) {
    logger.warn('[APP:Sentry] Failed to capture error', {
      error:
        sentryError instanceof Error ? sentryError.message : String(sentryError)
    })
  }
}
