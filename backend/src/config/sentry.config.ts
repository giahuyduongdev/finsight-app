import * as Sentry from '@sentry/node'
import type { Express, Request } from 'express'
import { Env } from './env.config'
import { logger } from './logger.config'

const SENSITIVE_HEADER_PATTERN =
  /^(authorization|authentication|cookie|set-cookie|x-.*(token|key|auth)|.*(token|key|auth).*)$/i

const SENSITIVE_FIELD_PATTERN =
  /(?:authorization|authentication|cookie|token|secret|password|api[-_]?key|filebuffer|base64|imageurl|receipturl|filename|email|title|amount|description|category|paymentmethod|rawjobpayload)/i

const BACKGROUND_EVENT_TYPES = new Set([
  'infrastructure_error',
  'final_failure',
  'unexpected_permanent_failure',
  'circuit_breaker_open',
  'shutdown_timeout'
])

const REDACTED = '[REDACTED]'
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi
const GOOGLE_API_KEY_PATTERN = /\bAIza[A-Za-z0-9_-]{20,}\b/g

const sanitizeString = (value: string): string => {
  const sanitized = value
    .replace(BEARER_PATTERN, REDACTED)
    .replace(GOOGLE_API_KEY_PATTERN, REDACTED)
    .replace(URL_PATTERN, REDACTED)

  return sanitized.length > 2000
    ? `${sanitized.slice(0, 2000)}[TRUNCATED]`
    : sanitized
}

const parseBoolean = (value: string, fallback: boolean) => {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

const parseSampleRate = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback
}

const sanitizeValue = (value: unknown, parentKey = '', depth = 0): unknown => {
  if (SENSITIVE_FIELD_PATTERN.test(parentKey)) return REDACTED
  if (depth > 6) return '[TRUNCATED]'
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, '', depth + 1))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeValue(item, key, depth + 1)
      ])
    )
  }
  if (typeof value === 'string') return sanitizeString(value)
  return value
}

export const scrubSentryEvent = (
  event: Sentry.ErrorEvent
): Sentry.ErrorEvent => {
  const headers = event.request?.headers
  if (headers) {
    for (const header of Object.keys(headers)) {
      if (SENSITIVE_HEADER_PATTERN.test(header)) {
        headers[header] = REDACTED
      }
    }
  }

  if (event.request) {
    event.request.data = sanitizeValue(event.request.data) as
      | string
      | Record<string, unknown>
      | undefined
    if (event.request.query_string) {
      event.request.query_string = REDACTED
    }
    if (event.request.cookies) {
      event.request.cookies = Object.fromEntries(
        Object.keys(event.request.cookies).map((key) => [key, REDACTED])
      )
    }
  }

  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    ...breadcrumb,
    message: breadcrumb.message
      ? sanitizeString(breadcrumb.message)
      : breadcrumb.message,
    data: sanitizeValue(breadcrumb.data) as Record<string, unknown> | undefined
  }))
  event.message = event.message ? sanitizeString(event.message) : event.message
  event.exception?.values?.forEach((exception) => {
    if (exception.value) exception.value = sanitizeString(exception.value)
  })
  event.contexts = sanitizeValue(event.contexts) as typeof event.contexts
  event.extra = sanitizeValue(event.extra) as typeof event.extra

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
    release: Env.SENTRY_RELEASE || undefined,
    tracesSampleRate: parseSampleRate(
      Env.SENTRY_TRACES_SAMPLE_RATE,
      Env.NODE_ENV === 'production' ? 0.1 : 1
    ),
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

export type BackgroundErrorContext = {
  component: string
  eventType: string
  queueName?: string
  errorClass?: string
  attempt?: number
  maxAttempts?: number
  correlationId?: string
  [key: string]: unknown
}

export const captureBackgroundError = (
  error: unknown,
  context: BackgroundErrorContext
): void => {
  if (
    !Env.SENTRY_DSN ||
    !parseBoolean(Env.SENTRY_BACKGROUND_ERRORS_ENABLED, true) ||
    !BACKGROUND_EVENT_TYPES.has(context.eventType)
  ) {
    return
  }

  try {
    Sentry.withScope((scope) => {
      scope.setTag('component', context.component)
      scope.setTag('eventType', context.eventType)
      if (context.queueName) scope.setTag('queueName', context.queueName)
      if (context.errorClass) scope.setTag('errorClass', context.errorClass)
      scope.setContext(
        'background',
        sanitizeValue(context) as Record<string, unknown>
      )
      Sentry.captureException(error)
    })
  } catch (sentryError) {
    logger.warn('[APP:Sentry] Failed to capture background error', {
      error:
        sentryError instanceof Error ? sentryError.message : String(sentryError)
    })
  }
}
